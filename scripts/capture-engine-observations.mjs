import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import resources from '../src/data/resources.json' with { type: 'json' };
import { verifiedEngineRows } from './diff-vehicle-observations.mjs';

const args = process.argv.slice(2);
const full = args[0] === '--full';
const [output, previousPath] = full ? args.slice(1) : args;
if (!output)
  throw new Error(
    'Usage: node scripts/capture-engine-observations.mjs [--full] output.json [previous.json]',
  );
const source = resources.heavy.id;
const sampleLimit = 250;
const scanLimit = 10000;
const lookupLimit = 50;
const timestamp = new Date();
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
}).formatToParts(timestamp);
const month = ['year', 'month']
  .map((type) => date.find((part) => part.type === type).value)
  .join('-');

async function read(action, query) {
  const url = new URL(action, 'https://data.gov.il/api/3/action/');
  url.search = new URLSearchParams(query);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok)
        throw new Error(`Engine source returned HTTP ${response.status}`);
      const body = await response.json();
      if (body.success !== true || !body.result)
        throw new Error('Unexpected CKAN response');
      return body.result;
    } catch (error) {
      if (attempt >= 2) throw error;
      await setTimeout(800 * 2 ** attempt);
    }
  }
}

async function rows(plates, offset = 0, limit = sampleLimit) {
  const result = await read('datastore_search', {
    resource_id: source,
    fields:
      '_id,mispar_rechev,mispar_shilda,mispar_manoa,tozeret_nm,degem_nm,degem_manoa',
    sort: full || plates ? '_id asc' : '_id desc',
    offset: String(offset),
    limit: String(limit),
    include_total: 'false',
    ...(plates && { filters: JSON.stringify({ mispar_rechev: plates }) }),
  });
  const records = result.records;
  if (
    !Array.isArray(records) ||
    records.some(
      (row) =>
        !row ||
        !Object.hasOwn(row, 'mispar_shilda') ||
        !Object.hasOwn(row, 'mispar_manoa') ||
        !Object.hasOwn(row, 'mispar_rechev') ||
        (plates && !plates.includes(Number(row.mispar_rechev))),
    ) ||
    (plates && records.length >= sampleLimit)
  )
    throw new Error('Engine source returned incomplete or unexpected rows');
  return records.map((row) => ({
    id: row._id,
    vehicleMaker: row.tozeret_nm,
    vehicleModel: row.degem_nm,
    engineModel: row.degem_manoa,
    plate: String(row.mispar_rechev),
    vin: row.mispar_shilda,
    engine: row.mispar_manoa,
    verified: true,
  }));
}

let observations;
if (full) {
  if (previousPath)
    throw new Error('Full capture scans the current frame directly');
  const revision = async () => {
    const meta = await read('resource_show', { id: source });
    if (!meta.last_modified || !Number.isFinite(Date.parse(meta.last_modified)))
      throw new Error('Engine registry revision unavailable');
    return meta.last_modified;
  };
  const before = await revision();
  const { total, total_was_estimated } = await read('datastore_search', {
    resource_id: source,
    limit: '0',
    include_total: 'true',
    total_estimation_threshold: '10000000',
  });
  if (!Number.isSafeInteger(total) || total <= 0 || total_was_estimated)
    throw new Error('Exact engine registry size unavailable');
  observations = [];
  let lastId = -1;
  for (let offset = 0; offset < total; offset += scanLimit) {
    if (offset) await setTimeout(500);
    const limit = Math.min(scanLimit, total - offset);
    const page = await rows(undefined, offset, limit);
    if (page.length !== limit)
      throw new Error(`Incomplete engine registry at offset ${offset}`);
    for (const row of page) {
      if (!Number.isSafeInteger(row.id) || row.id <= lastId)
        throw new Error('Engine registry rows are duplicated or unordered');
      lastId = row.id;
      observations.push(row);
    }
  }
  if ((await revision()) !== before)
    throw new Error('Engine registry revision changed during capture');
} else if (previousPath) {
  const previous = JSON.parse(await readFile(previousPath, 'utf8'));
  if (
    previous.source !== source ||
    !Array.isArray(previous.rows) ||
    !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(previous.month ?? '') ||
    previous.month >= month
  )
    throw new Error(
      'Expected an earlier snapshot from the same official resource',
    );
  const plates = [...verifiedEngineRows(previous.rows).values()].map(
    ({ plate }) => Number(plate),
  );
  if (!plates.length || plates.length > sampleLimit)
    throw new Error('The earlier snapshot has an unexpected sample size');
  observations = [];
  for (let offset = 0; offset < plates.length; offset += lookupLimit) {
    if (offset) await setTimeout(800);
    observations.push(
      ...(await rows(plates.slice(offset, offset + lookupLimit))),
    );
  }
} else {
  observations = await rows();
}
const verified = [...verifiedEngineRows(observations)].map(([vin, row]) => ({
  vin,
  ...row,
  verified: true,
}));
if (output !== '--check') {
  if (!verified.length) throw new Error('No verified observations to save');
  await writeFile(
    output,
    JSON.stringify(
      { month, source, fetchedAt: timestamp.toISOString(), rows: verified },
      null,
      2,
    ) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
}
console.log(
  JSON.stringify({
    month,
    sampled: observations.length,
    verified: verified.length,
  }),
);
