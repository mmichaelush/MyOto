import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import resources from '../src/data/resources.json' with { type: 'json' };
import { specialtySources } from '../src/domain/specialty-catalog.ts';

const path = new URL('../src/data/specialty-catalog.json', import.meta.url);
const temporary = new URL(
  `../src/data/specialty-catalog.json.${process.pid}.tmp`,
  import.meta.url,
);
const endpoint = 'https://data.gov.il/api/3/action/';
const pageSize = 50000;
const previous = process.argv.includes('--skip-unchanged')
  ? await readFile(path, 'utf8')
      .then(JSON.parse)
      .catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      })
  : undefined;

async function request(action, params) {
  const url = new URL(action, endpoint);
  url.search = new URLSearchParams(params);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`${action}: HTTP ${response.status}`);
      const body = await response.json();
      if (!body?.success || !body.result)
        throw new Error('Invalid source response');
      return body.result;
    } catch (error) {
      if (attempt >= 2) throw error;
      await setTimeout(2000 * 2 ** attempt);
    }
  }
}
async function revision(id) {
  const { last_modified } = await request('resource_show', { id });
  if (!Number.isFinite(Date.parse(last_modified)))
    throw new Error('Registry revision unavailable');
  return last_modified;
}
const label = (value) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const snapshots = {};
let changed = previous?.schema !== 1;
for (const [key, { fields }] of Object.entries(specialtySources)) {
  const resource = resources[key].id;
  const updatedAt = await revision(resource);
  if (
    previous?.schema === 1 &&
    previous.sources[key]?.updatedAt === updatedAt
  ) {
    snapshots[key] = previous.sources[key];
    continue;
  }
  changed = true;
  const { total, total_was_estimated } = await request('datastore_search', {
    resource_id: resource,
    limit: '0',
    include_total: 'true',
    total_estimation_threshold: '10000000',
  });
  if (!Number.isSafeInteger(total) || total <= 0 || total_was_estimated)
    throw new Error(`Exact source size unavailable: ${key}`);
  const groups = new Map();
  let lastId = -1;
  const columns = ['_id', 'shnat_yitzur', ...fields];
  for (let offset = 0; offset < total; offset += pageSize) {
    if (offset) await setTimeout(1200);
    const limit = Math.min(pageSize, total - offset);
    const { records } = await request('datastore_search', {
      resource_id: resource,
      fields: columns.join(','),
      sort: '_id asc',
      limit: String(limit),
      offset: String(offset),
      include_total: 'false',
    });
    if (!Array.isArray(records) || records.length !== limit)
      throw new Error(`Incomplete registry ${key}: ${offset}`);
    for (const row of records) {
      if (
        !row ||
        columns.some((column) => !Object.hasOwn(row, column)) ||
        !Number.isSafeInteger(row._id) ||
        row._id <= lastId
      )
        throw new Error(`Invalid source record in ${key}`);
      lastId = row._id;
      const year = /^\d{4}$/.test(String(row.shnat_yitzur))
        ? Number(row.shnat_yitzur)
        : null;
      const group = JSON.stringify([
        ...fields.map((field) => label(row[field])),
        year,
      ]);
      groups.set(group, (groups.get(group) ?? 0) + 1);
    }
  }
  if ((await revision(resource)) !== updatedAt)
    throw new Error(`Registry revision changed during scan: ${key}`);
  const rows = [...groups]
    .sort(([a], [b]) => a.localeCompare(b, 'he'))
    .map(([key, count]) => [...JSON.parse(key), count]);
  snapshots[key] = { updatedAt, total, rows };
  console.log(JSON.stringify({ source: key, total, groups: rows.length }));
}
if (!changed) process.exit(0);
try {
  await writeFile(
    temporary,
    JSON.stringify({ schema: 1, sources: snapshots }) + '\n',
    { flag: 'wx' },
  );
  await rename(temporary, path);
} finally {
  await rm(temporary, { force: true });
}
