import { registrationModelIndex } from '../src/domain/registrations.ts';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import resources from '../src/data/resources.json' with { type: 'json' };

const sources = {
  monthly: 'amount_monthly_closures_vehicles',
  monthlyNoModel: 'kamut_sgirot_hodshi_rechev_blikoddegem',
};
const output = new URL('../src/data/registrations.json', import.meta.url);
const temporary = new URL(
  `../src/data/registrations.json.${process.pid}.tmp`,
  import.meta.url,
);
const size = 10000;
const catalog = JSON.parse(
  await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8'),
);
const byModelKey = registrationModelIndex(catalog.makes);
const byModel = new Map();

async function action(name, params) {
  const url = new URL(name, 'https://data.gov.il/api/3/action/');
  url.search = new URLSearchParams(params);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success !== true || !data.result)
        throw new Error('Invalid CKAN response');
      return data.result;
    } catch (error) {
      if (attempt === 2) throw error;
      await setTimeout(1000 * 2 ** attempt);
    }
  }
}

async function revisions() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(sources).map(async ([key, dataset]) => {
        const value = await action('package_show', { id: dataset });
        const updatedAt = value.resources.find(
          ({ id }) => id === resources[key].id,
        )?.last_modified;
        if (!updatedAt || !Number.isFinite(Date.parse(updatedAt)))
          throw new Error(`Missing revision: ${key}`);
        return [key, updatedAt];
      }),
    ),
  );
}

const updatedAt = await revisions();
if (process.argv.includes('--skip-unchanged')) {
  const previous = await readFile(output, 'utf8')
    .then(JSON.parse)
    .catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  if (
    previous?.schema === 2 &&
    previous.catalogRevision === catalog.updatedAt &&
    JSON.stringify(previous.updatedAt) === JSON.stringify(updatedAt)
  ) {
    console.log('Registration source revisions are unchanged');
    process.exit(0);
  }
}

async function scan(key) {
  const counts = new Map();
  let total;
  let lastId = -1;
  for (let offset = 0; total === undefined || offset < total; offset += size) {
    const result = await action('datastore_search', {
      resource_id: resources[key].id,
      fields:
        key === 'monthly'
          ? '_id,sgira_month,car_num,sug_degem,tozeret_cd,degem_cd'
          : '_id,sgira_month,car_num',
      sort: '_id asc',
      limit: String(size),
      offset: String(offset),
      include_total: String(offset === 0),
      total_estimation_threshold: '1000000',
    });
    if (total === undefined) {
      total = result.total;
      if (
        !Number.isSafeInteger(total) ||
        total <= 0 ||
        result.total_was_estimated
      )
        throw new Error(`Invalid row count: ${key}`);
    }
    if (
      !Array.isArray(result.records) ||
      result.records.length !== Math.min(size, total - offset)
    ) {
      throw new Error(`Partial data for ${key} at offset ${offset}`);
    }
    for (const {
      _id,
      sgira_month: month,
      car_num: count,
      sug_degem,
      tozeret_cd,
      degem_cd,
    } of result.records) {
      if (
        !Number.isSafeInteger(_id) ||
        _id <= lastId ||
        !Number.isSafeInteger(count) ||
        count < 0 ||
        !/^20\d{2}(0[1-9]|1[0-2])$/.test(String(month))
      )
        throw new Error(`Invalid ordered record: ${key}`);
      lastId = _id;
      if (Number(month) >= 201801)
        counts.set(month, (counts.get(month) ?? 0) + count);
      if (key === 'monthly' && month >= 201801) {
        const path = byModelKey.get(
          [sug_degem, tozeret_cd, degem_cd].join('/'),
        );
        if (path) {
          const series = byModel.get(path) ?? new Map();
          series.set(month, (series.get(month) ?? 0) + count);
          byModel.set(path, series);
        }
      }
    }
    if (offset + size < total) await setTimeout(500);
  }
  return { counts, total };
}

const [coded, uncoded] = await Promise.all([
  scan('monthly'),
  scan('monthlyNoModel'),
]);
if (JSON.stringify(updatedAt) !== JSON.stringify(await revisions()))
  throw new Error('Registry refreshed mid-scan; retry');
const months = [
  ...new Set([...coded.counts.keys(), ...uncoded.counts.keys()]),
].sort((a, b) => a - b);
const recent = new Set(months.slice(-36));
const modelMonths = Object.fromEntries(
  [...byModel]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([path, series]) => {
      const rows = [...series]
        .filter(([month]) => recent.has(month))
        .sort(([a], [b]) => a - b);
      return rows.length ? [[path, rows]] : [];
    }),
);
const snapshot = {
  schema: 2,
  catalogRevision: catalog.updatedAt,
  modelMonths,
  fetchedAt: new Date().toISOString(),
  updatedAt,
  scannedRows: [coded.total, uncoded.total],
  months: months.map((month) => [
    month,
    coded.counts.get(month) ?? null,
    uncoded.counts.get(month) ?? null,
  ]),
};
await writeFile(temporary, JSON.stringify(snapshot) + '\n', {
  flag: 'wx',
});
await rename(temporary, output);
console.log(
  JSON.stringify({
    scannedRows: snapshot.scannedRows,
    months: months.length,
    first: months[0],
    last: months.at(-1),
  }),
);
