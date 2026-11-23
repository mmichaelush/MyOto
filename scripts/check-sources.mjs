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
for (const [name, fields] of Object.entries(required)) {
  try {
    const api = new URL('https://data.gov.il/api/3/action/datastore_search');
    api.search = new URLSearchParams({
      resource_id: registry[name].id,
      limit: '0',
      include_total: 'false',
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
    if (body.success !== true || !Array.isArray(body.result?.fields))
      throw new Error('Invalid schema response');
    const present = new Set(body.result.fields.map((field) => field.id));
    const missing = fields.filter((field) => !present.has(field));
    if (missing.length) throw new Error(`Missing ${missing.join(', ')}`);
    console.log(`${name} OK`);
  } catch (error) {
    console.error(`${name}: ${error.message}`);
    process.exitCode = 1;
  }
  await setTimeout(800);
}
