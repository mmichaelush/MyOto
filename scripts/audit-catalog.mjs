import { specialtySources } from '../src/domain/specialty-catalog.ts';
import { parseTireSize } from '../src/domain/tires.ts';
import { engineSlug, normalizeEngineCode } from '../src/domain/engine-code.ts';
import resources from '../src/data/resources.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const read = async (file, fallback) =>
  JSON.parse(
    await readFile(file ?? new URL(fallback, import.meta.url), 'utf8'),
  );
const [
  catalog,
  sample,
  engineSample,
  registrationSnapshot,
  electricSnapshot,
  tireSnapshot,
  specialtySnapshot,
] = await Promise.all([
  read(process.argv[2], '../src/data/catalog.json'),
  read(process.argv[3], '../src/data/cohorts.json'),
  read(process.argv[4], '../src/data/engine-catalog.json'),
  read(process.argv[5], '../src/data/registrations.json'),
  read(process.argv[6], '../src/data/electric-fleet.json'),
  read(process.argv[7], '../src/data/tire-catalog.json'),
  read(process.argv[8], '../src/data/specialty-catalog.json'),
]);
const slug = (value) =>
  typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const nonnegative = (value) => Number.isSafeInteger(value) && value >= 0;
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const name = (value) => typeof value === 'string' && value.trim().length > 0;
const validDate = (value) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const unique = (set, key, context) => {
  assert(!set.has(key), `Duplicate ${context}: ${key}`);
  set.add(key);
};

assert(
  validDate(catalog.fetchedAt) && validDate(catalog.updatedAt),
  'Invalid catalog dates',
);
assert(
  Array.isArray(catalog.makes) && catalog.makes.length,
  'Catalog has no makes',
);
const makes = new Set();
const variants = new Map();
for (const make of catalog.makes) {
  assert(slug(make.id) && name(make.name), 'Invalid manufacturer identity');
  unique(makes, make.id, 'manufacturer URL');
  assert(
    Array.isArray(make.models) && make.models.length,
    `No models for ${make.id}`,
  );
  const models = new Set();
  for (const model of make.models) {
    const path = `${make.id}/${model.id}`;
    assert(
      slug(model.id) && name(model.name),
      `Invalid model identity: ${path}`,
    );
    unique(models, model.id, path);
    assert(
      Array.isArray(model.records) && model.records.length,
      `No model records for ${path}`,
    );
    for (const record of model.records) {
      const [type, makeCode, modelCode, year, extra] = String(record.id).split(
        '/',
      );
      assert(
        extra === undefined &&
          ['P', 'M'].includes(type) &&
          type === record.type &&
          /^\d+$/.test(makeCode) &&
          String(record.code) === modelCode &&
          String(record.year) === year &&
          /^\d{4}$/.test(year) &&
          nonnegative(record.active) &&
          nonnegative(record.inactive) &&
          Array.isArray(record.variants),
        `Invalid count record: ${record.id} (${path})`,
      );
      assert(!variants.has(record.id), `Duplicate source key: ${record.id}`);
      variants.set(record.id, `${path}/${year}`);
    }
  }
}

assert(
  validDate(sample.fetchedAt) && positive(sample.sampleLimit),
  'Invalid cohort metadata',
);
const cohorts = Object.entries(sample.cohorts);
for (const [path, cohort] of cohorts) {
  assert(
    nonnegative(cohort.n) && cohort.n <= sample.sampleLimit,
    `Invalid sample size: ${path}`,
  );
  if (cohort.frameSize !== undefined)
    assert(
      nonnegative(cohort.frameSize) && cohort.frameSize >= cohort.n,
      `Invalid cohort frame: ${path}`,
    );
  assert(
    Array.isArray(cohort.variantKeys) && cohort.variantKeys.length > 0,
    `Missing cohort variant keys: ${path}`,
  );
  const keys = new Set();
  for (const key of cohort.variantKeys) {
    unique(keys, key, path);
    assert.equal(
      variants.get(key),
      path,
      `Cohort source key no longer matches catalog: ${key}`,
    );
  }
  for (const field of ['colors', 'ownership', 'fuel', 'trims']) {
    const distribution = cohort[field];
    assert(
      Array.isArray(distribution),
      `Missing ${field} distribution: ${path}`,
    );
    assert(
      distribution.every(([label, count]) => name(label) && positive(count)),
      `Invalid ${field} rows: ${path}`,
    );
    assert.equal(
      distribution.reduce((total, [, count]) => total + count, 0),
      cohort.n,
      `Invalid ${field} total: ${path}`,
    );
  }
  const mileage = cohort.mileage;
  if (mileage !== null)
    assert(
      positive(mileage.n) &&
        mileage.n <= cohort.n &&
        [mileage.p25, mileage.median, mileage.p75].every(positive) &&
        mileage.p25 <= mileage.median &&
        mileage.median <= mileage.p75,
      `Invalid mileage quartiles: ${path}`,
    );
  if (mileage?.bands) {
    let previous = 0;
    let tally = 0;
    for (const [limit, count] of mileage.bands) {
      assert(
        Number.isSafeInteger(limit) &&
          limit > previous &&
          limit % 10000 === 0 &&
          positive(count) &&
          count >= 5,
        `Invalid mileage band: ${path}`,
      );
      previous = limit;
      tally += count;
    }
    assert.equal(
      tally,
      mileage.n,
      `Mileage bands do not match the sample: ${path}`,
    );
  }
}
assert(
  engineSample.schema === 1 &&
    engineSample.source === resources.private_cars_1.id &&
    validDate(engineSample.fetchedAt) &&
    validDate(engineSample.updatedAt) &&
    positive(engineSample.sampled) &&
    positive(engineSample.population) &&
    engineSample.sampled <= engineSample.population &&
    nonnegative(engineSample.skipped),
  'Invalid engine sample metadata',
);
assert(
  Array.isArray(engineSample.entries) && engineSample.entries.length,
  'No engine codes',
);
const enginePaths = new Set();
let observations = engineSample.skipped;
for (const [code, matches] of engineSample.entries) {
  assert(
    typeof code === 'string' && normalizeEngineCode(code) === code,
    'Invalid engine code',
  );
  unique(enginePaths, engineSlug(code), 'engine URL');
  assert(
    Array.isArray(matches) && matches.length,
    `No model keys for engine ${code}`,
  );
  const engineKeys = new Set();
  for (const [key, observed] of matches) {
    assert(
      typeof key === 'string' &&
        /^[PM]\/\d+\/\d+\/\d{4}$/.test(key) &&
        positive(observed),
      `Invalid engine observation: ${code}`,
    );
    unique(engineKeys, key, code);
    observations += observed;
  }
}
assert.equal(
  observations,
  engineSample.sampled,
  'Engine sample totals disagree',
);
if (engineSample.retired !== undefined) {
  assert.equal(
    engineSample.sampled,
    engineSample.population,
    'Retired data requires full active scan',
  );
  assert.equal(
    engineSample.retiredFrames.length,
    3,
    'Expected three retired registry files',
  );
  assert.equal(
    engineSample.retiredUpdatedAt.length,
    3,
    'Expected three retired revisions',
  );
  assert(
    engineSample.retiredFrames.every(positive) &&
      engineSample.retiredUpdatedAt.every(validDate),
  );
  const codes = new Set();
  let retiredRows = 0;
  for (const [code, groups] of engineSample.retired) {
    assert(normalizeEngineCode(code) === code, 'Invalid retired engine code');
    unique(codes, code, 'retired engine code');
    assert(groups.length > 0, 'Retired engine code has no records');
    const details = new Set();
    for (const [
      year,
      engineMaker,
      vehicleMaker,
      vehicleModel,
      count,
    ] of groups) {
      assert(
        /^\d{4}$/.test(year) &&
          [engineMaker, vehicleMaker, vehicleModel].every(
            (value) => typeof value === 'string',
          ) &&
          positive(count),
        'Invalid retired engine record',
      );
      unique(
        details,
        JSON.stringify([year, engineMaker, vehicleMaker, vehicleModel]),
        'retired engine group',
      );
      retiredRows += count;
    }
  }
  assert(
    retiredRows > 0 &&
      retiredRows <=
        engineSample.retiredFrames.reduce((sum, count) => sum + count, 0),
    'Retired engine totals disagree',
  );
}
assert(
  registrationSnapshot.schema === 2 &&
    registrationSnapshot.catalogRevision === catalog.updatedAt &&
    validDate(registrationSnapshot.fetchedAt) &&
    validDate(registrationSnapshot.updatedAt?.monthly) &&
    validDate(registrationSnapshot.updatedAt?.monthlyNoModel) &&
    Array.isArray(registrationSnapshot.scannedRows) &&
    registrationSnapshot.scannedRows.length === 2 &&
    registrationSnapshot.scannedRows.every(positive) &&
    Array.isArray(registrationSnapshot.months) &&
    registrationSnapshot.months.length,
  'Invalid registration metadata',
);
let previousMonth = 201800;
for (const [month, coded, uncoded] of registrationSnapshot.months) {
  assert(
    Number.isSafeInteger(month) &&
      month > previousMonth &&
      /^20\d{2}(0[1-9]|1[0-2])$/.test(String(month)) &&
      (coded !== null || uncoded !== null) &&
      [coded, uncoded].every((value) => value === null || nonnegative(value)),
    `Invalid monthly registration row: ${month}`,
  );
  previousMonth = month;
}
const modelPaths = new Set(
  catalog.makes.flatMap((make) =>
    make.models.map((model) => make.id + '/' + model.id),
  ),
);
const latestMonths = new Map(
  registrationSnapshot.months
    .slice(-36)
    .map(([month, coded]) => [month, coded]),
);
const modelSums = new Map();
for (const [path, rows] of Object.entries(registrationSnapshot.modelMonths)) {
  assert(
    modelPaths.has(path) && Array.isArray(rows) && rows.length,
    `Unlinked registration model: ${path}`,
  );
  let last = 0;
  for (const [month, count] of rows) {
    assert(
      latestMonths.has(month) && month > last && nonnegative(count),
      `Invalid model registrations: ${path}`,
    );
    last = month;
    modelSums.set(month, (modelSums.get(month) ?? 0) + count);
  }
}
for (const [month, count] of modelSums) {
  assert(
    latestMonths.get(month) !== null && count <= latestMonths.get(month),
    `Model registrations exceed source total: ${month}`,
  );
}

assert(
  electricSnapshot.schema === 1 &&
    validDate(electricSnapshot.updatedAt) &&
    validDate(electricSnapshot.fetchedAt) &&
    Array.isArray(electricSnapshot.rows) &&
    electricSnapshot.rows.length,
  'Invalid electric fleet snapshot',
);
const electricKeys = new Set();
let electricTotal = 0;
for (const [district, subdistrict, ownership, count] of electricSnapshot.rows) {
  const labels = [district, subdistrict, ownership];
  assert(
    labels.every((part) => typeof part === 'string') && nonnegative(count),
    'Invalid electric fleet counts',
  );
  unique(electricKeys, JSON.stringify(labels), 'electric fleet partition');
  electricTotal += count;
}
assert(positive(electricTotal), 'Electric fleet snapshot has no vehicles');
assert(
  tireSnapshot.schema === 1 &&
    tireSnapshot.source === resources.private_cars_1.id &&
    validDate(tireSnapshot.updatedAt) &&
    positive(tireSnapshot.total) &&
    tireSnapshot.entries.length,
  'Invalid tire snapshot metadata',
);
const tireSizes = new Set();
let frontTotal = 0;
let rearTotal = 0;
for (const [size, counts] of tireSnapshot.entries) {
  assert(parseTireSize(size) && counts.length, 'Invalid tire size');
  unique(tireSizes, size, 'tire size');
  const keys = new Set();
  for (const [key, front, rear] of counts) {
    assert(
      /^[PM]\/\d+\/\d+\/\d{4}$/.test(key) &&
        nonnegative(front) &&
        nonnegative(rear) &&
        front + rear > 0,
      'Invalid tire fitment',
    );
    unique(keys, key, 'tire variant');
    frontTotal += front;
    rearTotal += rear;
  }
}
assert(
  frontTotal <= tireSnapshot.total && rearTotal <= tireSnapshot.total,
  'Tire counts exceed registry size',
);
assert.equal(specialtySnapshot.schema, 1, 'Invalid specialty catalog schema');
assert.equal(
  Object.keys(specialtySnapshot.sources).length,
  Object.keys(specialtySources).length,
);
for (const key of Object.keys(specialtySources)) {
  const section = specialtySnapshot.sources[key];
  assert(
    validDate(section.updatedAt) &&
      positive(section.total) &&
      section.rows.length,
    `Invalid specialty source ${key}`,
  );
  const seen = new Set();
  let total = 0;
  for (const [make, model, category, year, count] of section.rows) {
    assert(
      [make, model, category].every((field) => typeof field === 'string') &&
        (year === null || Number.isInteger(year)) &&
        positive(count),
      `Invalid grouping in ${key}`,
    );
    unique(seen, JSON.stringify([make, model, category, year]), key);
    total += count;
  }
  assert.equal(
    total,
    section.total,
    `Inconsistent specialty source total for ${key}`,
  );
}
console.log(
  `Catalog audit passed: ${makes.size} manufacturers, ${variants.size} count records and ${cohorts.length} cohorts, ${enginePaths.size} observed engine codes, ${Object.keys(registrationSnapshot.modelMonths).length} registration series, and ${electricKeys.size} electric fleet partitions, and ${tireSizes.size} tire sizes.`,
);
