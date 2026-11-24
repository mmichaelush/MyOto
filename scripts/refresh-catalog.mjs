import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const read = async (url) => JSON.parse(await readFile(url, 'utf8'));
const resources = await read(
  new URL('../src/data/resources.json', import.meta.url),
);
const output = new URL('../src/data/catalog.json', import.meta.url);
const cache = new URL('../.astro/catalog-cache/', import.meta.url);
const endpoint = 'https://data.gov.il/api/3/action/';
const limit = 5000;
const keyFields = ['sug_degem', 'tozeret_cd', 'degem_cd', 'shnat_yitzur'];
const projections = {
  modelCounts: [
    'tozar',
    'tozeret_nm',
    ...keyFields,
    'degem_nm',
    'kinuy_mishari',
    'mispar_rechavim_pailim',
    'mispar_rechavim_le_pailim',
  ],
  modelDetails: [
    ...keyFields,
    'ramat_gimur',
    'delek_nm',
    'nefah_manoa',
    'automatic_ind',
  ],
};
// Aliases are for navigation. Both discovery and counts come from the registry.
const makeAliases = {
  מיצובישי: 'mitsubishi',
  טויוטה: 'toyota',
  יונדאי: 'hyundai',
  קיה: 'kia',
  ניסאן: 'nissan',
  הונדה: 'honda',
  סקודה: 'skoda',
  מאזדה: 'mazda',
  סוזוקי: 'suzuki',
  טסלה: 'tesla',
  רנו: 'renault',
  פורד: 'ford',
};
const modelAliases = {
  LANCER: ['לנסר', 'לאנסר'],
  OUTLANDER: ['אאוטלנדר'],
  PAJERO: ['פאג׳רו'],
  COROLLA: ['קורולה'],
  YARIS: ['יאריס'],
  'RAV 4 HYBRID': ['ראב 4'],
  'LAND CRUISER': ['לנד קרוזר'],
  TUCSON: ['טוסון'],
  IONIQ: ['איוניק'],
};

async function fetchResult(action, params) {
  const url = new URL(action, endpoint);
  url.search = new URLSearchParams(params);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success !== true || !data.result)
        throw new Error('Invalid CKAN envelope');
      return data.result;
    } catch (error) {
      if (attempt === 2)
        throw new Error(`${action}: ${error.message}`, { cause: error });
      await setTimeout(1000 * 2 ** attempt);
    }
  }
}

async function metadata() {
  const generation = await fetchResult('package_show', {
    id: 'degem-rechev-wltp',
  });
  return Object.fromEntries(
    Object.keys(projections).map((name) => {
      const resource = generation.resources.find(
        (entry) => entry.id === resources[name].id,
      );
      if (!resource?.last_modified)
        throw new Error(`Missing resource revision: ${name}`);
      return [name, resource.last_modified];
    }),
  );
}

const generation = await metadata();
await mkdir(cache, { recursive: true });
const marker = new URL('generation.json', cache);
const old = await read(marker).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
const resume =
  JSON.stringify(old) === JSON.stringify(generation) ||
  (!old && process.argv.includes('--adopt-checkpoint'));
if (!resume) {
  // Store successive revisions in separate directories so a failed refresh is reversible.
  console.log('Starting a new CKAN revision');
}
const revision = createHash('sha256')
  .update(JSON.stringify(generation))
  .digest('hex')
  .slice(0, 12);
const checkpoint = new URL(`${revision}/`, cache);
await mkdir(checkpoint, { recursive: true });

async function* scan(name) {
  const fields = projections[name];
  for (let offset = 0; offset <= 150000;) {
    const filename = `${name}-${offset}.json`;
    const file = new URL(filename, checkpoint);
    let page = await read(file).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (!page && resume && !old)
      page = await read(new URL(filename, cache)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    if (!page) {
      page = await fetchResult('datastore_search', {
        resource_id: resources[name].id,
        fields: fields.join(','),
        limit,
        offset,
        sort: '_id asc',
        include_total: 'false',
      });
      await setTimeout(800);
    }
    if (
      !Array.isArray(page.records) ||
      page.records.some((row) =>
        fields.some((field) => !Object.hasOwn(row, field)),
      )
    )
      throw new Error(`Schema mismatch: ${name} offset ${offset}`);
    const temporary = new URL(filename + '.tmp', checkpoint);
    await writeFile(
      temporary,
      JSON.stringify({ records: page.records, limit: page.limit }),
    );
    await rename(temporary, file);
    yield* page.records;
    if (page.records.length < Math.min(page.limit || limit, limit)) return;
    offset += page.records.length;
  }
  throw new Error(`Safety limit exceeded while scanning ${name}`);
}

function clean(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/g, ' ')
    : '';
}
function slug(value) {
  if (/^[a-z0-9]+(?: [a-z0-9]+)*$/i.test(value))
    return value.toLowerCase().replace(/ /g, '-');
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${ascii || 'id'}-${createHash('sha256').update(value).digest('hex').slice(0, 12)}`;
}
const key = (row) => keyFields.map((field) => row[field]).join('/');
const specs = new Map();
for await (const row of scan('modelDetails')) {
  const id = key(row);
  const variants = specs.get(id) ?? new Map();
  const value = [
    clean(row.ramat_gimur) || null,
    clean(row.delek_nm) || null,
    row.nefah_manoa,
    row.automatic_ind,
  ];
  variants.set(JSON.stringify(value), value);
  specs.set(id, variants);
}

const makes = new Map();
const seen = new Map();
let excluded = 0;
for await (const row of scan('modelCounts')) {
  const makeName = clean(row.tozar) || clean(row.tozeret_nm);
  const modelName = (
    clean(row.kinuy_mishari) || clean(row.degem_nm)
  ).toUpperCase();
  const year = Number(row.shnat_yitzur);
  const id = key(row);
  const counts = [row.mispar_rechavim_pailim, row.mispar_rechavim_le_pailim];
  if (
    !makeName ||
    !modelName ||
    !Number.isInteger(year) ||
    year < 1900 ||
    year > new Date().getUTCFullYear() + 1 ||
    keyFields.some((field) => row[field] === null || row[field] === '') ||
    counts.some((count) => !Number.isSafeInteger(count) || count < 0)
  ) {
    excluded++;
    continue;
  }
  const fingerprint = JSON.stringify([makeName, modelName, counts]);
  if (seen.has(id)) {
    if (seen.get(id) !== fingerprint)
      throw new Error(`Conflicting counts for ${id}`);
    continue;
  }
  seen.set(id, fingerprint);
  const makeId = makeAliases[makeName] ?? slug(makeName);
  const make = makes.get(makeId) ?? {
    id: makeId,
    name: makeName,
    models: new Map(),
  };
  if (make.name !== makeName)
    throw new Error(`Manufacturer slug collision: ${makeId}`);
  makes.set(makeId, make);
  const modelId = slug(modelName);
  const model = make.models.get(modelId) ?? {
    id: modelId,
    name: modelName,
    aliases: modelAliases[modelName] ?? [],
    records: [],
  };
  if (model.name !== modelName)
    throw new Error(`Model slug collision: ${makeId}/${modelId}`);
  make.models.set(modelId, model);
  model.records.push({
    id,
    year,
    code: row.degem_cd,
    type: row.sug_degem,
    name: row.degem_nm,
    active: counts[0],
    inactive: counts[1],
    variants: [...(specs.get(id)?.values() ?? [])],
  });
}
if (seen.size < 90000 || makes.size < 100)
  throw new Error('National catalog coverage unexpectedly low');
if (JSON.stringify(await metadata()) !== JSON.stringify(generation))
  throw new Error('Source changed during the refresh');
const snapshot = {
  fetchedAt: new Date().toISOString(),
  updatedAt: generation.modelCounts,
  generation,
  excluded,
  makes: [...makes.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'he'))
    .map((make) => ({
      ...make,
      models: [...make.models.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'he'),
      ),
    })),
};
const temporary = new URL('./catalog.json.tmp', output);
await writeFile(temporary, JSON.stringify(snapshot) + '\n');
await rename(temporary, output);
await writeFile(marker, JSON.stringify(generation));
console.log(
  JSON.stringify({
    makes: makes.size,
    models: snapshot.makes.reduce((n, make) => n + make.models.length, 0),
    variants: seen.size,
    excluded,
  }),
);
