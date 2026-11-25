import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import assert from 'node:assert/strict';

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error('Usage: validate-engine-summary.mjs input.json output.json');

const summary = JSON.parse(await readFile(input, 'utf8'));
const month = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const resultCount = (value, total) =>
  value === null ||
  (count(value) &&
    total >= 20 &&
    (value === 0 || value >= 5) &&
    value <= total &&
    (value === total || total - value >= 5));
const optionalCount = (value, total) =>
  value === undefined || resultCount(value, total);
const label = (value) =>
  typeof value === 'string' && value.trim() && value.length <= 180;
const allowedSummary = new Set([
  'schema',
  'from',
  'to',
  'fromDate',
  'toDate',
  'comparable',
  'changed',
  'comparedReadings',
  'decreasedReadings',
  'earlierVerified',
  'laterVerified',
  'observedRate',
  'byModel',
]);
const allowedGroup = new Set([
  'make',
  'model',
  'vehicleMaker',
  'vehicleModel',
  'engineModel',
  'comparable',
  'changed',
  'observedKm',
]);

assert(
  summary.schema === 1 &&
    Object.keys(summary).every((field) => allowedSummary.has(field)),
  'Unexpected summary fields',
);
assert(
  month.test(summary.from) &&
    month.test(summary.to) &&
    summary.from < summary.to,
  'Expected two ordered months for a scheduled publication',
);
assert(
  /^(private|heavy)-\d{4}-\d{2}\.json$/.test(basename(output)) &&
    basename(output).endsWith('-' + summary.to + '.json'),
  'File name does not match the period',
);
assert(
  count(summary.comparable) && resultCount(summary.changed, summary.comparable),
  'Invalid change totals',
);
for (const verified of [summary.earlierVerified, summary.laterVerified]) {
  if (verified !== undefined)
    assert(
      count(verified) && verified >= summary.comparable,
      'Invalid verified totals',
    );
}
if (summary.observedRate !== undefined)
  assert(
    summary.observedRate ===
      (summary.changed === null ? null : summary.changed / summary.comparable),
    'Invalid observed rate',
  );
if (
  summary.comparedReadings !== undefined ||
  summary.decreasedReadings !== undefined
)
  assert(
    count(summary.comparedReadings) &&
      optionalCount(summary.decreasedReadings, summary.comparedReadings),
    'Invalid odometer totals',
  );
if (summary.fromDate !== undefined || summary.toDate !== undefined)
  assert(
    Number.isFinite(Date.parse(summary.fromDate)) &&
      Number.isFinite(Date.parse(summary.toDate)) &&
      Date.parse(summary.fromDate) < Date.parse(summary.toDate),
    'Invalid observation dates',
  );

const groups = summary.byModel ?? [];
assert(Array.isArray(groups), 'Invalid model summaries');
const seen = new Set();
for (const row of groups) {
  assert(
    row && Object.keys(row).every((field) => allowedGroup.has(field)),
    'Unexpected model summary fields',
  );
  const make = row.make ?? row.vehicleMaker;
  const model = row.model ?? row.vehicleModel;
  assert(
    label(make) && label(model) && label(row.engineModel),
    'Invalid model summary labels',
  );
  assert(
    count(row.comparable) &&
      row.comparable >= 20 &&
      count(row.changed) &&
      row.changed >= 5 &&
      row.changed <= row.comparable &&
      (row.changed === row.comparable || row.comparable - row.changed >= 5) &&
      row.comparable <= summary.comparable,
    'Invalid model summary counts',
  );
  assert(
    row.observedKm == null ||
      (count(row.observedKm) && row.observedKm <= 2_000_000),
    'Invalid observed mileage',
  );
  const id = JSON.stringify([make, model, row.engineModel]);
  assert(!seen.has(id), 'Duplicate model summary');
  seen.add(id);
}
const canonical = JSON.stringify(summary, null, 2) + '\n';
try {
  await writeFile(output, canonical, { flag: 'wx' });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  const existing = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(
    existing,
    summary,
    'A different result already exists for this fleet and month',
  );
}
