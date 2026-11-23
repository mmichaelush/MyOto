import { readFile, rename, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const file = (name) => new URL(`../src/data/${name}.json`, import.meta.url);
const resources = JSON.parse(await readFile(file('resources'), 'utf8'));
const catalog = JSON.parse(await readFile(file('catalog'), 'utf8'));
const cohorts = [
  ['mitsubishi', 'lancer', 2010],
  ['toyota', 'corolla', 2021],
  ['hyundai', 'tucson', 2022],
];
const sampleLimit = 200;

async function rows(source, filters, fields, limit) {
  const url = new URL('https://data.gov.il/api/3/action/datastore_search');
  url.search = new URLSearchParams({
    resource_id: resources[source].id,
    filters: JSON.stringify(filters),
    fields: fields.join(','),
    limit,
    sort: '_id asc',
    include_total: 'false',
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
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
  return body.result.records;
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

const result = {
  fetchedAt: new Date().toISOString(),
  sampleLimit,
  cohorts: {},
};
for (const [make, slug, year] of cohorts) {
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
  const plateRows = await rows(
    'private_cars_1',
    { shnat_yitzur: year, kinuy_mishari: model.name, tozeret_cd: makerCodes },
    [
      'mispar_rechev',
      'shnat_yitzur',
      'sug_degem',
      'tozeret_cd',
      'degem_cd',
      'tzeva_rechev',
      'baalut',
      'sug_delek_nm',
      'ramat_gimur',
    ],
    sampleLimit,
  );
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
  const mileage = new Map();
  for (let offset = 0; offset < plates.length; offset += 50) {
    const requested = plates.slice(offset, offset + 50);
    const history = await rows(
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
      const km = row.kilometer_test_aharon;
      if (!Number.isSafeInteger(km) || km <= 0) continue;
      if (
        mileage.has(row.mispar_rechev) &&
        mileage.get(row.mispar_rechev) !== km
      )
        mileage.set(row.mispar_rechev, null);
      else mileage.set(row.mispar_rechev, km);
    }
  }
  const readings = [...mileage.values()]
    .filter((km) => km !== null)
    .sort((a, b) => a - b);
  const percentile = (p) => readings[Math.round(p * (readings.length - 1))];
  result.cohorts[`${make}/${slug}/${year}`] = {
    variantKeys: [...keys],
    n: sample.length,
    colors: distribution(sample, 'tzeva_rechev'),
    ownership: distribution(sample, 'baalut'),
    fuel: distribution(sample, 'sug_delek_nm'),
    trims: distribution(sample, 'ramat_gimur'),
    mileage:
      readings.length >= 20
        ? {
            n: readings.length,
            p25: percentile(0.25),
            median: percentile(0.5),
            p75: percentile(0.75),
          }
        : null,
  };
}
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
