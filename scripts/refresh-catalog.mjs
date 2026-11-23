import { readFile, rename, writeFile } from 'node:fs/promises';

const registry = JSON.parse(
  await readFile(
    new URL('../src/data/resources.json', import.meta.url),
    'utf8',
  ),
);
const groups = [
  {
    id: 'mitsubishi',
    label: 'מיצובישי',
    models: {
      LANCER: ['לנסר', 'לאנסר'],
      OUTLANDER: ['אאוטלנדר'],
      ASX: [],
      PAJERO: ['פאג׳רו'],
    },
  },
  {
    id: 'toyota',
    label: 'טויוטה',
    models: {
      COROLLA: ['קורולה'],
      YARIS: ['יאריס'],
      'RAV 4 HYBRID': ['ראב 4'],
      'LAND CRUISER': ['לנד קרוזר'],
    },
  },
  {
    id: 'hyundai',
    label: 'יונדאי',
    models: {
      I10: ['i10'],
      I20: ['i20'],
      TUCSON: ['טוסון'],
      IONIQ: ['איוניק'],
    },
  },
];

const endpoint = 'https://data.gov.il/api/3/action/';
const counts = registry.modelCounts;
const details = registry.modelDetails;
const target = new URL('../src/data/catalog.json', import.meta.url);
const temporary = new URL('../src/data/catalog.json.tmp', import.meta.url);
const keyFields = ['sug_degem', 'tozeret_cd', 'degem_cd', 'shnat_yitzur'];
const batchSize = 500;

async function action(name, params) {
  const url = new URL(name, endpoint);
  url.search = new URLSearchParams(params);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${name} returned ${response.status}`);
  const body = await response.json();
  if (body.success !== true || !body.result) throw new Error(`${name} failed`);
  return body.result;
}

async function rows(resource, filters, fields) {
  const all = [];
  for (let offset = 0; offset < 4000; offset += batchSize) {
    const result = await action('datastore_search', {
      resource_id: resource.id,
      filters: JSON.stringify(filters),
      sort: '_id asc',
      fields: fields.join(','),
      limit: batchSize,
      offset,
      include_total: 'false',
    });
    if (
      !Array.isArray(result.records) ||
      result.records.some((row) =>
        fields.some((field) => !Object.hasOwn(row, field)),
      )
    ) {
      throw new Error(`Schema changed for ${resource.id}`);
    }
    all.push(...result.records);
    if (result.records.length < batchSize) return all;
  }
  throw new Error(
    `Configured catalog query exceeds its request budget for ${resource.id}`,
  );
}

const pkg = await action('package_show', { id: 'degem-rechev-wltp' });
const snapshot = {
  fetchedAt: new Date().toISOString(),
  updatedAt:
    pkg.resources.find((resource) => resource.id === counts.id)
      ?.last_modified ?? null,
  makes: [],
};
for (const group of groups) {
  const modelNames = Object.keys(group.models);
  const countsRows = await rows(
    counts,
    { tozar: group.label, kinuy_mishari: modelNames },
    [
      ...keyFields,
      'kinuy_mishari',
      'degem_nm',
      'mispar_rechavim_pailim',
      'mispar_rechavim_le_pailim',
    ],
  );
  if (!countsRows.length)
    throw new Error(`Catalog has no rows for ${group.id}`);
  const tozeret = [...new Set(countsRows.map((row) => row.tozeret_cd))];
  const variants = await rows(
    details,
    { tozeret_cd: tozeret, kinuy_mishari: modelNames },
    [...keyFields, 'ramat_gimur', 'delek_nm', 'nefah_manoa', 'automatic_ind'],
  );
  const key = (row) => keyFields.map((field) => row[field]).join('/');
  const byKey = new Map();
  for (const variant of variants) {
    const list = byKey.get(key(variant)) ?? new Map();
    const spec = [
      variant.ramat_gimur,
      variant.delek_nm,
      variant.nefah_manoa,
      variant.automatic_ind,
    ];
    list.set(JSON.stringify(spec), spec);
    byKey.set(key(variant), list);
  }
  const models = [];
  for (const name of modelNames) {
    const matching = countsRows.filter((row) => row.kinuy_mishari === name);
    const records = new Map();
    for (const row of matching) {
      if (
        !keyFields.every((field) => row[field] != null) ||
        ![row.mispar_rechavim_pailim, row.mispar_rechavim_le_pailim].every(
          (count) => Number.isSafeInteger(count) && count >= 0,
        )
      ) {
        throw new Error(`Invalid counts for ${group.id} ${name}`);
      }
      const id = key(row);
      const record = {
        id,
        year: row.shnat_yitzur,
        code: row.degem_cd,
        type: row.sug_degem,
        name: row.degem_nm,
        active: row.mispar_rechavim_pailim,
        inactive: row.mispar_rechavim_le_pailim,
        variants: [...(byKey.get(id)?.values() ?? [])],
      };
      if (
        records.has(id) &&
        JSON.stringify(records.get(id)) !== JSON.stringify(record)
      ) {
        throw new Error(`Conflicting duplicate count row ${id}`);
      }
      records.set(id, record);
    }
    if (records.size)
      models.push({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name,
        aliases: group.models[name],
        records: [...records.values()],
      });
  }
  if (!models.length) throw new Error(`No verified models for ${group.id}`);
  snapshot.makes.push({ id: group.id, name: group.label, models });
}
await writeFile(temporary, JSON.stringify(snapshot) + '\n');
await rename(temporary, target);
console.log(
  snapshot.makes
    .map(
      (make) =>
        `${make.id}: ${make.models.map((model) => model.name + ' (' + model.records.length + ')').join(', ')}`,
    )
    .join('\n'),
);
