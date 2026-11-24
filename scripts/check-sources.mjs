import { setTimeout } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';

const registry = JSON.parse(
  await readFile(
    new URL('../src/data/resources.json', import.meta.url),
    'utf8',
  ),
);
const regular = [
  'private_cars_1',
  'private_cars_2',
  'personalImport',
  'heavy',
  'twoWheeled',
  'publicTransport',
  'offRoad_1',
  'offRoad_2',
  'offRoad_3',
  'frozen_with_model',
  'frozen_no_model',
  'history_1',
  'history_2',
  'filters',
  'safetyDiscount',
  'anchors',
];
const model = ['modelDetails', 'modelCounts', 'importers'];
const required = {
  ...Object.fromEntries(regular.map((source) => [source, ['mispar_rechev']])),
  ...Object.fromEntries(
    model.map((source) => [
      source,
      ['sug_degem', 'tozeret_cd', 'degem_cd', 'shnat_yitzur'],
    ]),
  ),
  recall: ['MISPAR_RECHEV', 'RECALL_ID'],
  disabledPermit: ['MISPAR RECHEV'],
  busFleet: ['bus_license_id'],
  cme: ['mispar_tzama'],
  campaigns: ['RECALL_ID'],
};
async function query(name, parameters) {
  const api = new URL('https://data.gov.il/api/3/action/datastore_search');
  api.search = new URLSearchParams({
    resource_id: registry[name].id,
    include_total: 'false',
    ...parameters,
  });
  const response = await fetch(api, {
    signal: AbortSignal.timeout(12000),
    headers: { Origin: 'https://mmichaelush.github.io' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const cors = response.headers.get('access-control-allow-origin');
  if (cors !== '*' && cors !== 'https://mmichaelush.github.io')
    throw new Error('Missing CORS permission');
  const body = await response.json();
  if (
    body.success !== true ||
    !Array.isArray(body.result?.fields) ||
    !Array.isArray(body.result.records)
  )
    throw new Error('Invalid schema response');
  return body.result;
}
for (const [name, fields] of Object.entries(required)) {
  try {
    const selected = ['_id', ...fields];
    const params = { fields: selected.join(','), sort: '_id asc' };
    const sample = await query(name, { ...params, limit: '2' });
    const present = new Set(sample.fields.map((field) => field.id));
    const missing = fields.filter((field) => !present.has(field));
    if (missing.length) throw new Error(`Missing ${missing.join(', ')}`);
    const samples = sample.records.filter((row) =>
      fields.every(
        (field) =>
          row[field] !== null && row[field] !== undefined && row[field] !== '',
      ),
    );
    if (!samples.length) throw new Error('No replayable sample keys');
    await setTimeout(800);
    const singleField = fields.length === 1 || name === 'recall';
    const key = fields[0];
    const keys = [...new Set(samples.map((row) => row[key]))];
    const replayFields = singleField ? [key] : fields;
    const filters = singleField
      ? { [key]: keys }
      : Object.fromEntries(fields.map((field) => [field, samples[0][field]]));
    const replay = await query(name, {
      ...params,
      filters: JSON.stringify(filters),
      limit: '20',
    });
    if (
      !replay.records.length ||
      replay.records.some((row) =>
        replayFields.some((field) =>
          singleField
            ? !keys.includes(row[field])
            : row[field] !== filters[field],
        ),
      )
    )
      throw new Error('Exact filter returned unexpected records');
    if (
      singleField &&
      keys.some((value) => !replay.records.some((row) => row[key] === value))
    )
      throw new Error('An exact array value was missing');
    if (name === 'offRoad_2' && keys.length === 2) {
      await setTimeout(800);
      const next = await query(name, {
        ...params,
        filters: JSON.stringify(filters),
        limit: '1',
        offset: '1',
      });
      if (next.records[0]?._id !== replay.records[1]?._id)
        throw new Error('Offset did not advance as expected');
    }
    console.log(
      `${name} OK (${singleField ? 'exact array' : 'exact composite'})`,
    );
  } catch (error) {
    console.error(`${name}: ${error.message}`);
    process.exitCode = 1;
  }
  await setTimeout(800);
}
