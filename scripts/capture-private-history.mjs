import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout } from 'node:timers/promises';
import resources from '../src/data/resources.json' with { type: 'json' };
import { normalizeEngineCode } from '../src/domain/engine-code.ts';

const [path, mode] = process.argv.slice(2);
if (!path || (mode && mode !== '--check'))
  throw new Error(
    'Usage: node scripts/capture-private-history.mjs output.sqlite | :memory: --check',
  );

const check = mode === '--check';
const file = check ? ':memory:' : resolve(path);
const registry = resources.private_cars_1.id;
const history = resources.history_1.id;
const pageSize = 50000;
const captured = new Date().toISOString();
const month = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: '2-digit',
  timeZone: 'Asia/Jerusalem',
}).format(new Date(captured));

async function read(action, parameters) {
  const url = new URL(action, 'https://data.gov.il/api/3/action/');
  url.search = new URLSearchParams(parameters);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok)
        throw new Error(`${action} returned HTTP ${response.status}`);
      const body = await response.json();
      if (body.success !== true || !body.result)
        throw new Error('Unexpected CKAN response');
      return body.result;
    } catch (error) {
      if (attempt === 2) throw error;
      await setTimeout(1500 * 2 ** attempt);
    }
  }
}

async function revision(source) {
  const { last_modified } = await read('resource_show', { id: source });
  if (!last_modified || !Number.isFinite(Date.parse(last_modified)))
    throw new Error('Source revision is unavailable');
  return last_modified;
}

async function scan(db, source, fields, consume) {
  const { total, total_was_estimated } = await read('datastore_search', {
    resource_id: source,
    limit: '0',
    include_total: 'true',
    total_estimation_threshold: '10000000',
  });
  if (!Number.isSafeInteger(total) || total <= 0 || total_was_estimated)
    throw new Error('Exact source size is unavailable');
  const target = check ? Math.min(total, pageSize) : total;
  let lastId = -1;
  for (let offset = 0; offset < target; offset += pageSize) {
    if (offset) await setTimeout(900);
    const limit = Math.min(pageSize, target - offset);
    const { records } = await read('datastore_search', {
      resource_id: source,
      fields: ['_id', ...fields].join(','),
      sort: '_id asc',
      include_total: 'false',
      limit: String(limit),
      offset: String(offset),
    });
    if (!Array.isArray(records) || records.length !== limit)
      throw new Error(`Incomplete registry page at offset ${offset}`);
    db.exec('BEGIN');
    try {
      for (const row of records) {
        if (
          !Number.isSafeInteger(row._id) ||
          row._id <= lastId ||
          fields.some((field) => !Object.hasOwn(row, field))
        )
          throw new Error('Unexpected registry projection or row order');
        lastId = row._id;
        if (/^\d{4,8}$/.test(String(row.mispar_rechev))) consume(row);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    if (offset % (20 * pageSize) === 0)
      console.log(`Scanned ${source}: ${offset + limit}/${target}`);
  }
  return target;
}

const digits = (value) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '');
const safeText = (value) =>
  typeof value === 'string' ? value.trim().slice(0, 140) : '';
const normalizedMonth = (value) =>
  String(value ?? '')
    .replace(/^(\d{4})-(\d)$/, '$1-0$2')
    .match(/^\d{4}-(?:0[1-9]|1[0-2])(?=$|-)/)?.[0] ?? '';

if (!check) {
  const { open } = await import('node:fs/promises');
  await (await open(file, 'wx', 0o600)).close();
}
let db;
try {
  db = new DatabaseSync(file);
  // The capture is disposable until both source scans and the integrity check finish.
  db.exec('PRAGMA journal_mode = MEMORY; PRAGMA cache_size = -65536;');
  const start = await Promise.all([revision(registry), revision(history)]);
  db.exec(`
    CREATE TABLE vehicle (
      plate INTEGER PRIMARY KEY, vin TEXT, registration TEXT, maker TEXT,
      model TEXT, engineModel TEXT, testDate TEXT, ambiguous INTEGER DEFAULT 0
    );
    CREATE TABLE reading (
      plate INTEGER PRIMARY KEY, registration TEXT, engine TEXT,
      odometer INTEGER, ambiguous INTEGER DEFAULT 0
    );
  `);
  const insertVehicle =
    db.prepare(`INSERT INTO vehicle VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(plate) DO UPDATE SET ambiguous = 1`);
  const insertReading = db.prepare(`INSERT INTO reading VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(plate) DO UPDATE SET ambiguous = 1`);
  const registryRows = await scan(
    db,
    registry,
    [
      'mispar_rechev',
      'misgeret',
      'moed_aliya_lakvish',
      'tozeret_nm',
      'kinuy_mishari',
      'degem_manoa',
      'mivchan_acharon_dt',
    ],
    (row) => {
      const vin = digits(row.misgeret);
      insertVehicle.run(
        Number(row.mispar_rechev),
        /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) && !/^(.)\1+$/.test(vin) ? vin : null,
        normalizedMonth(row.moed_aliya_lakvish),
        safeText(row.tozeret_nm),
        safeText(row.kinuy_mishari),
        normalizeEngineCode(row.degem_manoa) ?? null,
        /^\d{4}-\d{2}-\d{2}$/.test(row.mivchan_acharon_dt)
          ? row.mivchan_acharon_dt
          : null,
      );
    },
  );
  const historyRows = await scan(
    db,
    history,
    [
      'mispar_rechev',
      'rishum_rishon_dt',
      'mispar_manoa',
      'kilometer_test_aharon',
    ],
    (row) => {
      const serial = digits(row.mispar_manoa);
      const mileage = row.kilometer_test_aharon;
      insertReading.run(
        Number(row.mispar_rechev),
        normalizedMonth(row.rishum_rishon_dt),
        /^[A-Z0-9]{5,30}$/.test(serial) && !/^(.)\1+$/.test(serial)
          ? serial
          : null,
        Number.isSafeInteger(mileage) && mileage > 0 && mileage <= 2_000_000
          ? mileage
          : null,
      );
    },
  );
  const end = await Promise.all([revision(registry), revision(history)]);
  if (start.some((revision, index) => revision !== end[index]))
    throw new Error('Registry revision changed during capture');
  db.exec(`
    CREATE TABLE observations AS
      SELECT v.plate, v.vin, v.maker, v.model, v.engineModel, v.testDate, r.engine, r.odometer
      FROM vehicle v JOIN reading r ON v.plate = r.plate
      WHERE NOT v.ambiguous AND NOT r.ambiguous AND v.vin IS NOT NULL
        AND v.registration <> '' AND v.registration = r.registration
        AND (r.engine IS NOT NULL OR r.odometer IS NOT NULL);
    DELETE FROM observations WHERE vin IN (
      SELECT vin FROM observations GROUP BY vin HAVING count(*) <> 1
    );
    CREATE UNIQUE INDEX observations_vehicle ON observations(vin, plate);
    DROP TABLE vehicle;
    DROP TABLE reading;
    CREATE TABLE capture (month TEXT, observedAt TEXT, registryRevision TEXT, historyRevision TEXT);
  `);
  db.prepare('INSERT INTO capture VALUES (?, ?, ?, ?)').run(
    month,
    captured,
    ...start,
  );
  const { linked } = db
    .prepare('SELECT count(*) AS linked FROM observations')
    .get();
  if (!check && !linked) throw new Error('No verified private observations');
  if (!check) {
    db.exec('VACUUM');
    if (db.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok')
      throw new Error('Private snapshot integrity check failed');
  }
  console.log(JSON.stringify({ month, registryRows, historyRows, linked }));
  db.close();
} catch (error) {
  db?.close();
  if (!check) await rm(file, { force: true });
  throw error;
}
