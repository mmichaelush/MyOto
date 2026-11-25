import { readFile, rename, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { mileageSummary, sampleWindows } from '../src/domain/statistics.ts';

const file = (name) => new URL(`../src/data/${name}.json`, import.meta.url);
const resources = JSON.parse(await readFile(file('resources'), 'utf8'));
const catalog = JSON.parse(await readFile(file('catalog'), 'utf8'));
const standardCohorts = [
  ['mitsubishi', 'lancer', 2010],
  ['toyota', 'corolla', 2021],
  ['hyundai', 'tucson', 2022],
];
const sampleLimit = 200;
const before2017 = process.argv.includes('--before-2017');
const allCohorts = process.argv.includes('--all-cohorts');

function olderCohorts() {
  const groups = [];
  for (const make of catalog.makes) {
    for (const model of make.models) {
      const active = new Map();
      for (const record of model.records) {
        if (record.year >= 2017) continue;
        active.set(record.year, (active.get(record.year) ?? 0) + record.active);
      }
      for (const [year, count] of active)
        if (count >= sampleLimit)
          groups.push({
            point: [make.id, model.id, year],
            count,
            key: make.id + '/' + model.id + '/' + year,
          });
    }
  }
  return groups
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 6)
    .map((group) => group.point);
}

const cohorts = [
  ...(!before2017 || allCohorts ? standardCohorts : []),
  ...(before2017 || allCohorts ? olderCohorts() : []),
];
const prior = JSON.parse(await readFile(file('cohorts'), 'utf8'));

async function rows(
  source,
  filters,
  fields,
  limit,
  offset = 0,
  includeTotal = false,
) {
  const url = new URL('https://data.gov.il/api/3/action/datastore_search');
  url.search = new URLSearchParams({
    resource_id: resources[source].id,
    filters: JSON.stringify(filters),
    fields: fields.join(','),
    limit,
    offset,
    sort: source === 'private_cars_1' ? 'mispar_rechev asc,_id asc' : '_id asc',
    include_total: String(includeTotal),
    ...(includeTotal && { total_estimation_threshold: '1000000' }),
  });
  let response;
  for (const attempt of [1, 2]) {
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(18000) });
    } catch (error) {
      if (attempt === 2)
        throw new Error(`${source} request failed (${error.name})`, {
          cause: error,
        });
    }
    if (response && response.status !== 429 && response.status < 500) break;
    if (attempt === 1) await setTimeout(3000);
  }
  if (!response.ok) throw new Error(`${source} returned ${response.status}`);
  const body = await response.json();
  if (
    body.success !== true ||
    !Array.isArray(body.result?.records) ||
    body.result.records.some((row) =>
      fields.some((field) => !Object.hasOwn(row, field)),
    )
  ) {
    throw new Error(`Invalid ${source} response`);
  }
  await setTimeout(800);
  return body.result;
}

function distribution(sample, field) {
  const values = new Map();
  for (const row of sample) {
    const label = String(row[field] ?? '').trim() || 'לא ידוע';
    values.set(label, (values.get(label) ?? 0) + 1);
  }
  const published = [...values]
    .filter(([, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1]);
  const remainder =
    sample.length - published.reduce((sum, [, count]) => sum + count, 0);
  if (remainder) published.push(['קטגוריות נוספות', remainder]);
  return published;
}

function ownershipByTrim(sample) {
  const counts = new Map();
  for (const row of sample) {
    const trim = String(row.ramat_gimur ?? '').trim();
    const ownership = String(row.baalut ?? '').trim();
    if (!trim || !ownership) continue;
    const key = JSON.stringify([trim, ownership]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].flatMap(([key, count]) =>
    count >= 5 ? [[...JSON.parse(key), count]] : [],
  );
}

const result = {
  fetchedAt: prior.fetchedAt,
  sampleLimit,
  method: 'stratified-rank-windows',
  cohorts: { ...prior.cohorts },
};
const observedAt = new Date().toISOString();
let refreshed = 0;
for (const [make, slug, year] of cohorts) {
  console.log(`Sampling ${make}/${slug}/${year}`);
  const model = catalog.makes
    .find((entry) => entry.id === make)
    ?.models.find((entry) => entry.id === slug);
  const variants = model?.records.filter((variant) => variant.year === year);
  if (!variants?.length)
    throw new Error(`No count rows for ${make}/${slug}/${year}`);
  const keys = new Set(variants.map((variant) => variant.id));
  const makerCodes = [
    ...new Set(variants.map((variant) => Number(variant.id.split('/')[1]))),
  ];
  const filters = {
    shnat_yitzur: year,
    kinuy_mishari: model.name,
    tozeret_cd: makerCodes,
  };
  const fields = [
    'mispar_rechev',
    'shnat_yitzur',
    'sug_degem',
    'tozeret_cd',
    'degem_cd',
    'tzeva_rechev',
    'baalut',
    'sug_delek_nm',
    'ramat_gimur',
  ];
  const frame = await rows(
    'private_cars_1',
    filters,
    ['mispar_rechev'],
    0,
    0,
    true,
  );
  if (
    frame.total_was_estimated ||
    !Number.isSafeInteger(frame.total) ||
    frame.total < 0
  )
    throw new Error(
      `Exact cohort size unavailable for ${make}/${slug}/${year}`,
    );
  const plateRows = [];
  for (const window of sampleWindows(frame.total, sampleLimit, 8)) {
    const page = await rows(
      'private_cars_1',
      filters,
      fields,
      window.limit,
      window.offset,
    );
    if (page.records.length !== window.limit)
      throw new Error('Cohort changed during sampling');
    plateRows.push(...page.records);
  }
  const sample = [
    ...new Map(
      plateRows
        .filter((row) =>
          keys.has(
            [
              row.sug_degem,
              row.tozeret_cd,
              row.degem_cd,
              row.shnat_yitzur,
            ].join('/'),
          ),
        )
        .map((row) => [row.mispar_rechev, row]),
    ).values(),
  ];
  if (sample.length < 20) continue;
  const plates = sample.map((row) => row.mispar_rechev);
  const mileage = [];
  for (let offset = 0; offset < plates.length; offset += 50) {
    const requested = plates.slice(offset, offset + 50);
    const { records: history } = await rows(
      'history_1',
      { mispar_rechev: requested },
      ['mispar_rechev', 'kilometer_test_aharon'],
      200,
    );
    if (history.length >= 200)
      throw new Error('Mileage reply may be truncated');
    for (const row of history) {
      if (!requested.includes(row.mispar_rechev))
        throw new Error('Mileage source returned an unrequested key');
      mileage.push(row);
    }
  }
  result.cohorts[`${make}/${slug}/${year}`] = {
    fetchedAt: observedAt,
    variantKeys: [...keys],
    n: sample.length,
    frameSize: frame.total,
    colors: distribution(sample, 'tzeva_rechev'),
    ownership: distribution(sample, 'baalut'),
    ownershipByTrim: ownershipByTrim(sample),
    fuel: distribution(sample, 'sug_delek_nm'),
    trims: distribution(sample, 'ramat_gimur'),
    mileage: mileageSummary(mileage, 20, true),
  };
  refreshed++;
}
if (refreshed === 0)
  throw new Error('No cohorts could be published from this sample');
const temporary = new URL('./cohorts.json.tmp', file('cohorts'));
await writeFile(temporary, JSON.stringify(result) + '\n');
await rename(temporary, file('cohorts'));
console.log(
  Object.entries(result.cohorts)
    .map(
      ([key, stats]) =>
        `${key}: ${stats.n} vehicles, ${stats.mileage?.n ?? 0} published mileage readings`,
    )
    .join('\n'),
);
