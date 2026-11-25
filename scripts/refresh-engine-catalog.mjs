import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import resources from '../src/data/resources.json' with { type: 'json' };
import { sampleWindows } from '../src/domain/statistics.ts';
import { normalizeEngineCode } from '../src/domain/engine-code.ts';

const source = resources.private_cars_1.id;
const retiredSources = ['offRoad_1', 'offRoad_2', 'offRoad_3'].map(
  (key) => resources[key].id,
);
const retiredFields = [
  '_id',
  'degem_manoa',
  'tozar_manoa',
  'tozeret_nm',
  'kinuy_mishari',
  'degem_nm',
  'bitul_dt',
];
const output = new URL('../src/data/engine-catalog.json', import.meta.url);
const temporary = new URL(
  `../src/data/engine-catalog.json.${process.pid}.tmp`,
  import.meta.url,
);
const fields = [
  '_id',
  'degem_manoa',
  'sug_degem',
  'tozeret_cd',
  'degem_cd',
  'shnat_yitzur',
];
const target = 24000;
const full = process.argv.includes('--full');
const serial = process.argv.includes('--serial');
const pageSize = 10000;

async function read(action, search) {
  const url = new URL(action, 'https://data.gov.il/api/3/action/');
  url.search = new URLSearchParams(search);
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (response.status !== 429 && response.status < 500) break;
      if (attempt < 2) await response.body?.cancel();
    } catch (error) {
      if (attempt === 2) throw error;
    }
    if (attempt < 2) await setTimeout(1000 * 2 ** attempt);
  }
  if (!response.ok)
    throw new Error(`${action} returned HTTP ${response.status}`);
  const body = await response.json();
  if (body.success !== true || !body.result)
    throw new Error('Unexpected CKAN envelope');
  return body.result;
}

async function revisions(datasetId, ids) {
  const dataset = await read('package_show', {
    id: datasetId,
  });
  return ids.map((id) => {
    const current = dataset.resources.find(
      (resource) => resource.id === id,
    )?.last_modified;
    if (!current || !Number.isFinite(Date.parse(current)))
      throw new Error(`Registry revision unavailable for ${id}`);
    return current;
  });
}
const activeRevision = () =>
  revisions('private-and-commercial-vehicles', [source]);
const retiredRevision = () => revisions('reshev_bitul_sofi', retiredSources);
const [updatedAt] = await activeRevision();
const retiredUpdatedAt = full ? await retiredRevision() : undefined;
if (process.argv.includes('--skip-unchanged')) {
  const previous = await readFile(output, 'utf8')
    .then(JSON.parse)
    .catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  if (
    previous?.schema === 1 &&
    previous.source === source &&
    previous.updatedAt === updatedAt &&
    (!full ||
      (previous.sampled === previous.population &&
        JSON.stringify(previous.retiredUpdatedAt) ===
          JSON.stringify(retiredUpdatedAt)))
  ) {
    console.log('Engine registry revision is unchanged');
    process.exit(0);
  }
}
async function frameSize(resource) {
  const frame = await read('datastore_search', {
    resource_id: resource,
    limit: '0',
    include_total: 'true',
    total_estimation_threshold: '10000000',
  });
  if (
    !Number.isSafeInteger(frame.total) ||
    frame.total <= 0 ||
    frame.total_was_estimated
  )
    throw new Error(`An exact registry size is required for ${resource}`);
  return frame.total;
}
function allPages(population) {
  return Array.from(
    { length: Math.ceil(population / pageSize) },
    (_, page) => ({
      offset: page * pageSize,
      limit: Math.min(pageSize, population - page * pageSize),
    }),
  );
}
async function* scan(resource, columns, windows) {
  let lastId = -1;
  const concurrency = full && !serial ? 4 : 1;
  for (let index = 0; index < windows.length; index += concurrency) {
    if (index) await setTimeout(serial ? 1500 : 800);
    const pages = await Promise.all(
      windows
        .slice(index, index + concurrency)
        .map(async ({ offset, limit }) => ({
          offset,
          limit,
          result: await read('datastore_search', {
            resource_id: resource,
            fields: columns.join(','),
            sort: '_id asc',
            include_total: 'false',
            limit: String(limit),
            offset: String(offset),
          }),
        })),
    );
    for (const { offset, limit, result } of pages) {
      if (!Array.isArray(result.records) || result.records.length !== limit)
        throw new Error(
          `Incomplete registry scan for ${resource} at offset ${offset}`,
        );
      for (const row of result.records) {
        if (
          !row ||
          columns.some((field) => !Object.hasOwn(row, field)) ||
          !Number.isSafeInteger(row._id) ||
          row._id <= lastId
        )
          throw new Error(
            `Unexpected or unordered registry row for ${resource}`,
          );
        lastId = row._id;
        yield row;
      }
    }
    if (full && index % 100 === 0)
      console.log(
        `Scanned ${resource}: ${Math.min(index + concurrency, windows.length)}/${windows.length} pages`,
      );
  }
}
const population = await frameSize(source);
const windows = full
  ? allPages(population)
  : sampleWindows(population, target, 24);
const codes = new Map();
let sampled = 0;
let skipped = 0;
for await (const row of scan(source, fields, windows)) {
  sampled++;
  const { degem_manoa, sug_degem, tozeret_cd, degem_cd, shnat_yitzur } = row;
  const code = normalizeEngineCode(degem_manoa);
  if (
    !code ||
    !['P', 'M'].includes(sug_degem) ||
    ![tozeret_cd, degem_cd, shnat_yitzur].every(Number.isSafeInteger) ||
    shnat_yitzur < 1900
  ) {
    skipped++;
    continue;
  }
  const key = [sug_degem, tozeret_cd, degem_cd, shnat_yitzur].join('/');
  const keys = codes.get(code) ?? new Map();
  keys.set(key, (keys.get(key) ?? 0) + 1);
  codes.set(code, keys);
}
if ((await activeRevision())[0] !== updatedAt)
  throw new Error(
    'Registry revision changed during the scan; retry with a consistent source',
  );
const entries = [...codes]
  .sort(([a], [b]) => a.localeCompare(b, 'en'))
  .map(([code, keys]) => [
    code,
    [...keys].sort(([a], [b]) => a.localeCompare(b, 'en')),
  ]);
const retired = new Map();
const retiredFrames = [];
if (full) {
  for (const resource of retiredSources) {
    const total = await frameSize(resource);
    retiredFrames.push(total);
    for await (const row of scan(resource, retiredFields, allPages(total))) {
      const code = normalizeEngineCode(row.degem_manoa);
      const year = /^(\d{4})-\d{2}-\d{2}/.exec(String(row.bitul_dt))?.[1];
      if (!code || !year) continue;
      const details = JSON.stringify([
        year,
        String(row.tozar_manoa ?? '').trim(),
        String(row.tozeret_nm ?? '').trim(),
        String(row.kinuy_mishari ?? '').trim() ||
          String(row.degem_nm ?? '').trim(),
      ]);
      const groups = retired.get(code) ?? new Map();
      groups.set(details, (groups.get(details) ?? 0) + 1);
      retired.set(code, groups);
    }
  }
  if (
    JSON.stringify(await retiredRevision()) !==
      JSON.stringify(retiredUpdatedAt) ||
    (await activeRevision())[0] !== updatedAt
  )
    throw new Error('Registry revisions changed during the scan');
}
const snapshot = {
  schema: 1,
  source,
  updatedAt,
  fetchedAt: new Date().toISOString(),
  population,
  sampled,
  skipped,
  entries,
  ...(full && {
    retiredUpdatedAt,
    retiredFrames,
    retired: [...retired]
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([code, groups]) => {
        const rows = [...groups].map(([key, count]) => [
          ...JSON.parse(key),
          count,
        ]);
        rows.sort(
          (a, b) =>
            Number(b[0]) - Number(a[0]) ||
            b[4] - a[4] ||
            JSON.stringify(a).localeCompare(JSON.stringify(b), 'he'),
        );
        return [code, rows];
      }),
  }),
};
await writeFile(temporary, JSON.stringify(snapshot) + '\n');
try {
  await rename(temporary, output);
} finally {
  await rm(temporary, { force: true });
}
console.log(
  JSON.stringify({
    codes: entries.length,
    population,
    sampled,
    skipped,
    updatedAt,
  }),
);
