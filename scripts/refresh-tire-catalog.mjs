import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import resources from '../src/data/resources.json' with { type: 'json' };
import { parseTireSize } from '../src/domain/tires.ts';

const path = new URL('../src/data/tire-catalog.json', import.meta.url);
const temporary = new URL(
  `../src/data/tire-catalog.json.${process.pid}.tmp`,
  import.meta.url,
);
const source = resources.private_cars_1.id;
const pageSize = 50000;
const projection =
  '_id,sug_degem,tozeret_cd,degem_cd,shnat_yitzur,zmig_kidmi,zmig_ahori';

async function request(action, parameters) {
  const url = new URL(action, 'https://data.gov.il/api/3/action/');
  url.search = new URLSearchParams(parameters);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`${action}: HTTP ${response.status}`);
      const body = await response.json();
      if (body?.success !== true || !body.result)
        throw new Error('Invalid CKAN response');
      return body.result;
    } catch (error) {
      if (attempt === 2) throw error;
      await setTimeout(2000 * 2 ** attempt);
    }
  }
}
async function revision() {
  const { last_modified } = await request('resource_show', { id: source });
  if (!Number.isFinite(Date.parse(last_modified)))
    throw new Error('Source revision unavailable');
  return last_modified;
}

function normalized(value) {
  if (typeof value !== 'string') return;
  const parsed = parseTireSize(value);
  if (!parsed) return;
  return `${parsed.width}/${parsed.aspect}R${parsed.rim}${/C\s*$/i.test(value) ? 'C' : ''}`;
}

const updatedAt = await revision();
if (process.argv.includes('--skip-unchanged')) {
  const previous = await readFile(path, 'utf8')
    .then(JSON.parse)
    .catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  if (previous?.schema === 1 && previous.updatedAt === updatedAt) {
    console.log('Tire catalog revision is unchanged');
    process.exit(0);
  }
}
const { total, total_was_estimated } = await request('datastore_search', {
  resource_id: source,
  limit: '0',
  include_total: 'true',
  total_estimation_threshold: '10000000',
});
if (!Number.isSafeInteger(total) || total <= 0 || total_was_estimated)
  throw new Error('Exact registry size unavailable');

const sizes = new Map();
let lastId = -1;
for (let offset = 0; offset < total; offset += pageSize) {
  if (offset) await setTimeout(1000);
  const limit = Math.min(pageSize, total - offset);
  const { records } = await request('datastore_search', {
    resource_id: source,
    fields: projection,
    sort: '_id asc',
    include_total: 'false',
    limit: String(limit),
    offset: String(offset),
  });
  if (!Array.isArray(records) || records.length !== limit)
    throw new Error(`Incomplete registry page at offset ${offset}`);
  for (const row of records) {
    if (
      !Number.isSafeInteger(row._id) ||
      row._id <= lastId ||
      !Object.hasOwn(row, 'zmig_kidmi') ||
      !Object.hasOwn(row, 'zmig_ahori')
    )
      throw new Error('Unexpected source fields or sort order');
    lastId = row._id;
    if (
      !['P', 'M'].includes(row.sug_degem) ||
      ![row.tozeret_cd, row.degem_cd, row.shnat_yitzur].every(
        Number.isSafeInteger,
      )
    )
      continue;
    const key = [
      row.sug_degem,
      row.tozeret_cd,
      row.degem_cd,
      row.shnat_yitzur,
    ].join('/');
    const tires = [normalized(row.zmig_kidmi), normalized(row.zmig_ahori)];
    for (const [side, size] of tires.entries()) {
      if (!size) continue;
      const variants = sizes.get(size) ?? new Map();
      const counts = variants.get(key) ?? [0, 0];
      counts[side]++;
      variants.set(key, counts);
      sizes.set(size, variants);
    }
  }
  if (offset % (20 * pageSize) === 0)
    console.log(`Scanned ${offset + limit}/${total}`);
}
if ((await revision()) !== updatedAt)
  throw new Error('Registry revision changed during scan');
const entries = [...sizes]
  .sort(([a], [b]) => a.localeCompare(b, 'en'))
  .map(([size, variants]) => [
    size,
    [...variants]
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([key, counts]) => [key, ...counts]),
  ]);
if (!entries.length) throw new Error('No tire sizes found');
try {
  await writeFile(
    temporary,
    JSON.stringify({ schema: 1, source, updatedAt, total, entries }) + '\n',
    { flag: 'wx' },
  );
  await rename(temporary, path);
} finally {
  await rm(temporary, { force: true });
}
console.log(JSON.stringify({ sizes: entries.length, total, updatedAt }));
