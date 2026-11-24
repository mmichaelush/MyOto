import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import resources from '../src/data/resources.json' with { type: 'json' };
import { verifiedEngineRows } from './diff-vehicle-observations.mjs';

const [output, previousPath] = process.argv.slice(2);
if (!output)
  throw new Error(
    'Usage: node scripts/capture-engine-observations.mjs output.json [previous.json]',
  );
const source = resources.heavy.id;
const sampleLimit = 250;
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

async function rows(plates) {
  const url = new URL('https://data.gov.il/api/3/action/datastore_search');
  url.search = new URLSearchParams({
    resource_id: source,
    fields: 'mispar_rechev,mispar_shilda,mispar_manoa',
    sort: plates ? '_id asc' : '_id desc',
    limit: String(sampleLimit),
    include_total: 'false',
    ...(plates && { filters: JSON.stringify({ mispar_rechev: plates }) }),
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok)
    throw new Error(`Engine source returned HTTP ${response.status}`);
  const body = await response.json();
  const records = body.result?.records;
  if (
    body.success !== true ||
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
    plate: String(row.mispar_rechev),
    vin: row.mispar_shilda,
    engine: row.mispar_manoa,
    verified: true,
  }));
}

let observations;
if (previousPath) {
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
