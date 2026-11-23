import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const period = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const normalize = (value) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[\s-]/g, '') : '';

function byVehicle(snapshot) {
  const vehicles = new Map();
  const ambiguous = new Set();
  for (const row of snapshot.rows) {
    if (!row || row.verified !== true) continue;
    const vin = normalize(row.vin);
    const plate = normalize(row.plate);
    const engine = normalize(row.engine);
    if (
      !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ||
      /^([A-Z0-9])\1+$/.test(vin) ||
      !/^\d{4,8}$/.test(plate) ||
      !/^[A-Z0-9]{5,30}$/.test(engine) ||
      /^([A-Z0-9])\1+$/.test(engine)
    )
      continue;
    const existing = vehicles.get(vin);
    if (existing && (existing.engine !== engine || existing.plate !== plate))
      ambiguous.add(vin);
    vehicles.set(vin, { plate, engine });
  }
  for (const vin of ambiguous) vehicles.delete(vin);
  return vehicles;
}

export function compareObservedEngines(before, after) {
  if (
    !period.test(before?.month ?? '') ||
    !period.test(after?.month ?? '') ||
    before.month >= after.month ||
    !Array.isArray(before.rows) ||
    !Array.isArray(after.rows)
  )
    throw new TypeError(
      'Expected two ordered observation months with verified rows',
    );
  const earlier = byVehicle(before);
  const later = byVehicle(after);
  const changes = [];
  for (const [vin, next] of later) {
    const old = earlier.get(vin);
    if (old && old.plate === next.plate && old.engine !== next.engine)
      changes.push({
        vin,
        plate: next.plate,
        previousEngine: old.engine,
        currentEngine: next.engine,
        previousObservation: before.month,
        observedChangeBy: after.month,
      });
  }
  return changes.sort((a, b) => a.vin.localeCompare(b.vin));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [beforePath, afterPath, outputPath] = process.argv.slice(2);
  if (!beforePath || !afterPath || !outputPath)
    throw new Error(
      'Usage: node scripts/diff-vehicle-observations.mjs before.json after.json output.json',
    );
  const before = JSON.parse(await readFile(beforePath, 'utf8'));
  const after = JSON.parse(await readFile(afterPath, 'utf8'));
  const changes = compareObservedEngines(before, after);
  await writeFile(outputPath, JSON.stringify({ changes }, null, 2) + '\n', {
    flag: 'wx',
  });
  console.log(JSON.stringify({ changes: changes.length }));
}
