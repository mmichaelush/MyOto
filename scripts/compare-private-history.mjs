import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const [before, after, output] = process.argv.slice(2);
if (!before || !after || !output)
  throw new Error(
    'Usage: node scripts/compare-private-history.mjs before.sqlite after.sqlite output.json',
  );

const db = new DatabaseSync(resolve(after), { readOnly: true });
try {
  db.prepare('ATTACH DATABASE ? AS earlier').run(resolve(before));
  const currentCapture = db
    .prepare('SELECT month, observedAt FROM main.capture')
    .get();
  const previousCapture = db
    .prepare('SELECT month, observedAt FROM earlier.capture')
    .get();
  const current = currentCapture?.month;
  const previous = previousCapture?.month;
  const start = Date.parse(previousCapture?.observedAt);
  const end = Date.parse(currentCapture?.observedAt);
  const month = /^\d{4}-(?:0[1-9]|1[0-2])$/;
  if (
    !month.test(previous ?? '') ||
    !month.test(current ?? '') ||
    previous > current ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start
  )
    throw new Error('Expected two ordered private registry observations');
  const pair = `
    FROM main.observations current JOIN earlier.observations previous
      ON current.vin = previous.vin AND current.plate = previous.plate
  `;
  const engineComparable =
    'previous.engine IS NOT NULL AND current.engine IS NOT NULL';
  const odometerComparable =
    'previous.odometer IS NOT NULL AND current.odometer IS NOT NULL';
  const { comparable, changed, comparedReadings, decreasedReadings } = db
    .prepare(
      `
    SELECT
      count(CASE WHEN ${engineComparable} THEN 1 END) AS comparable,
      count(CASE WHEN ${engineComparable} AND previous.engine <> current.engine THEN 1 END) AS changed,
      count(CASE WHEN ${odometerComparable} THEN 1 END) AS comparedReadings,
      count(CASE WHEN ${odometerComparable} AND current.odometer < previous.odometer THEN 1 END) AS decreasedReadings
    ${pair}
  `,
    )
    .get();
  const byModel = db
    .prepare(
      `
    SELECT current.maker, current.model, previous.engineModel,
      count(*) AS comparable,
      count(CASE WHEN previous.engine <> current.engine THEN 1 END) AS changed,
      CASE WHEN count(CASE WHEN previous.engine <> current.engine AND current.odometer IS NOT NULL THEN 1 END) >= 5
        THEN CAST(round(avg(CASE WHEN previous.engine <> current.engine THEN current.odometer END) / 1000) AS INTEGER) * 1000
      END AS observedKm
    ${pair}
    WHERE ${engineComparable}
      AND current.maker <> '' AND current.model <> '' AND previous.engineModel IS NOT NULL
    GROUP BY current.maker, current.model, previous.engineModel
    HAVING comparable >= 20 AND changed >= 5
      AND (changed = comparable OR comparable - changed >= 5)
    ORDER BY changed DESC, current.maker, current.model, previous.engineModel
  `,
    )
    .all();
  const publish = (size, count) =>
    size >= 20 &&
    (count === 0 || count >= 5) &&
    (count === size || size - count >= 5)
      ? count
      : null;
  const result = {
    schema: 1,
    from: previous,
    to: current,
    fromDate: previousCapture.observedAt,
    toDate: currentCapture.observedAt,
    comparable,
    changed: publish(comparable, changed),
    comparedReadings,
    decreasedReadings: publish(comparedReadings, decreasedReadings),
    byModel,
  };
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', {
    flag: 'wx',
  });
  console.log(
    JSON.stringify({
      from: previous,
      to: current,
      comparable,
      comparedReadings,
    }),
  );
} finally {
  db.close();
}
