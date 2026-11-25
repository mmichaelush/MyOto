import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';

const args = process.argv.slice(2);
const reportExport = args[0] === '--report';
const [plate, ...paths] = reportExport ? args.slice(1) : args;
if (!/^\d{4,8}$/.test(plate ?? '') || !paths.length)
  throw new Error(
    'Usage: node scripts/inspect-private-history.mjs [--report] plate snapshot.sqlite [snapshot.sqlite ...]',
  );

const rows = paths.flatMap((path) => {
  if (!statSync(path).isFile()) throw new Error('Expected a snapshot file');
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const capture = db.prepare('SELECT month, observedAt FROM capture').get();
    if (!Number.isFinite(Date.parse(capture?.observedAt)))
      throw new Error('Invalid snapshot date');
    const row = db
      .prepare(
        `
      SELECT vin, maker, model, engineModel, engine, odometer, testDate
      FROM observations WHERE plate = ?
    `,
      )
      .get(Number(plate));
    return row ? [{ ...capture, ...row }] : [];
  } finally {
    db.close();
  }
});
if (new Set(rows.map((row) => Date.parse(row.observedAt))).size !== rows.length)
  throw new Error('Use distinct snapshot dates');
if (new Set(rows.map((row) => row.vin)).size > 1)
  throw new Error(
    'The plate belongs to different vehicle identities across the snapshots',
  );

const chronology = rows.sort(
  (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
);
let lastEngine;
let lastReading;
const readings = [];
const engineChanges = [];
for (const row of chronology) {
  if (
    Number.isSafeInteger(row.odometer) &&
    (!row.testDate ||
      row.testDate !== lastReading?.testDate ||
      row.odometer !== lastReading.odometer)
  ) {
    readings.push({
      observedAt: row.observedAt,
      ...(row.testDate && { testDate: row.testDate }),
      kilometers: row.odometer,
      difference: lastReading ? row.odometer - lastReading.odometer : null,
    });
    lastReading = row;
  }
  if (row.engine) {
    if (lastEngine && row.engine !== lastEngine.engine)
      engineChanges.push({
        from: lastEngine.observedAt,
        to: row.observedAt,
        previousModel: lastEngine.engineModel,
        currentModel: row.engineModel,
      });
    lastEngine = row;
  }
}
const latest = chronology.at(-1);
console.log(
  JSON.stringify(
    {
      ...(reportExport &&
        latest && {
          schema: 1,
          plate: Number(plate),
          vehicleKey: createHash('sha256').update(latest.vin).digest('hex'),
        }),
      vehicle: latest ? { maker: latest.maker, model: latest.model } : null,
      readings,
      engineChanges,
    },
    null,
    2,
  ),
);
