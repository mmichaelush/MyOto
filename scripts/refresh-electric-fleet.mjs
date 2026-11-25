import { readFile, rename, writeFile } from 'node:fs/promises';
import resources from '../src/data/resources.json' with { type: 'json' };

const output = new URL('../src/data/electric-fleet.json', import.meta.url);
const temporary = new URL(
  `../src/data/electric-fleet.json.${process.pid}.tmp`,
  import.meta.url,
);
const endpoint = 'https://data.gov.il/api/3/action/';
async function fetchResult(action, params) {
  const url = new URL(action, endpoint);
  url.search = new URLSearchParams(params);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${action}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.success !== true || !body.result)
    throw new Error('Invalid electric fleet response');
  return body.result;
}

async function revision() {
  const dataset = await fetchResult('package_show', {
    id: 'rechavim_hashmalim',
  });
  const updatedAt = dataset.resources.find(
    ({ id }) => id === resources.electric.id,
  )?.last_modified;
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt)))
    throw new Error('Revision unavailable');
  return updatedAt;
}

const updatedAt = await revision();
if (process.argv.includes('--skip-unchanged')) {
  const old = await readFile(output, 'utf8')
    .then(JSON.parse)
    .catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  if (old?.schema === 1 && old.updatedAt === updatedAt) {
    console.log('Electric fleet revision is unchanged');
    process.exit(0);
  }
}
const result = await fetchResult('datastore_search', {
  resource_id: resources.electric.id,
  fields: 'baalut,mahoz_nm,nafa_nm,car_num',
  limit: '1000',
  include_total: 'true',
});
if (
  !Array.isArray(result.records) ||
  !result.records.length ||
  result.records.length !== result.total ||
  result.total_was_estimated
)
  throw new Error('Electric fleet coverage is incomplete');

const rows = [];
const combinations = new Set();
for (const { baalut, mahoz_nm, nafa_nm, car_num } of result.records) {
  if (
    !Number.isSafeInteger(car_num) ||
    car_num < 0 ||
    ![baalut, mahoz_nm, nafa_nm].every(
      (value) => value === null || typeof value === 'string',
    )
  )
    throw new Error('Invalid electric fleet row');
  const labels = [mahoz_nm, nafa_nm, baalut].map((value) =>
    (value ?? '').trim(),
  );
  const key = JSON.stringify(labels);
  if (combinations.has(key))
    throw new Error('Duplicate district, subdistrict and ownership');
  combinations.add(key);
  rows.push([...labels, car_num]);
}
if ((await revision()) !== updatedAt)
  throw new Error('Electric fleet updated during fetch');
await writeFile(
  temporary,
  JSON.stringify({
    schema: 1,
    updatedAt,
    fetchedAt: new Date().toISOString(),
    rows,
  }) + '\n',
  { flag: 'wx' },
);
await rename(temporary, output);
console.log(
  JSON.stringify({
    updatedAt,
    rows: rows.length,
    total: rows.reduce((sum, row) => sum + row[3], 0),
  }),
);
