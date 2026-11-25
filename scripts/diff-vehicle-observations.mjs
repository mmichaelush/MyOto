import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const period = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const normalize = (value) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[\s-]/g, '') : '';

export function verifiedEngineRows(rows) {
  const vehicles = new Map();
  const plates = new Map();
  const ambiguous = new Set();
  for (const row of rows) {
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
    const assigned = plates.get(plate);
    if (assigned && assigned !== vin) {
      ambiguous.add(vin);
      ambiguous.add(assigned);
    }
    plates.set(plate, vin);
    const context = Object.fromEntries(
      ['vehicleMaker', 'vehicleModel', 'engineModel'].flatMap((key) =>
        typeof row[key] === 'string' && row[key].trim()
          ? [[key, row[key].trim()]]
          : [],
      ),
    );
    vehicles.set(vin, { plate, engine, ...context });
  }
  for (const vin of ambiguous) vehicles.delete(vin);
  return vehicles;
}

function observedPair(before, after) {
  const start = Date.parse(before?.fetchedAt);
  const end = Date.parse(after?.fetchedAt);
  const sameMonth = before?.month === after?.month;
  if (
    !period.test(before?.month ?? '') ||
    !period.test(after?.month ?? '') ||
    before.month > after.month ||
    (sameMonth &&
      (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)) ||
    (before.source && after.source && before.source !== after.source) ||
    !Array.isArray(before.rows) ||
    !Array.isArray(after.rows)
  )
    throw new TypeError('Expected two ordered observations with verified rows');
  const earlier = verifiedEngineRows(before.rows);
  const later = verifiedEngineRows(after.rows);
  return { earlier, later };
}

export function compareObservedEngines(before, after) {
  const { earlier, later } = observedPair(before, after);
  const changes = [];
  for (const [vin, next] of later) {
    const old = earlier.get(vin);
    if (old && old.plate === next.plate && old.engine !== next.engine)
      changes.push({
        vin,
        plate: next.plate,
        previousEngine: old.engine,
        currentEngine: next.engine,
        ...(next.vehicleMaker && { vehicleMaker: next.vehicleMaker }),
        ...(next.vehicleModel && { vehicleModel: next.vehicleModel }),
        ...(old.engineModel && { previousEngineModel: old.engineModel }),
        ...(next.engineModel && { currentEngineModel: next.engineModel }),
        previousObservation: before.month,
        observedChangeBy: after.month,
      });
  }
  return changes.sort((a, b) => a.vin.localeCompare(b.vin));
}

export function summarizeObservedEngineChanges(before, after) {
  const { earlier, later } = observedPair(before, after);
  let comparable = 0;
  let changed = 0;
  const groups = new Map();
  for (const [vin, current] of later) {
    const previous = earlier.get(vin);
    if (!previous || previous.plate !== current.plate) continue;
    comparable++;
    const hasChanged = previous.engine !== current.engine;
    if (hasChanged) changed++;
    const { vehicleMaker, vehicleModel } = current;
    const engineModel = previous.engineModel;
    if (!vehicleMaker || !vehicleModel || !engineModel) continue;
    const key = JSON.stringify([vehicleMaker, vehicleModel, engineModel]);
    const group = groups.get(key) ?? {
      vehicleMaker,
      vehicleModel,
      engineModel,
      comparable: 0,
      changed: 0,
    };
    group.comparable++;
    if (hasChanged) group.changed++;
    groups.set(key, group);
  }
  const byModel = [...groups.values()]
    .filter(
      (group) =>
        group.comparable >= 20 &&
        group.changed >= 5 &&
        (group.changed === group.comparable ||
          group.comparable - group.changed >= 5),
    )
    .sort(
      (a, b) =>
        b.changed - a.changed ||
        a.vehicleMaker.localeCompare(b.vehicleMaker, 'he') ||
        a.vehicleModel.localeCompare(b.vehicleModel, 'he') ||
        a.engineModel.localeCompare(b.engineModel, 'en'),
    );
  const publishable =
    comparable >= 20 &&
    (changed === 0 || changed >= 5) &&
    (changed === comparable || comparable - changed >= 5);
  return {
    schema: 1,
    from: before.month,
    to: after.month,
    ...(before.fetchedAt &&
      after.fetchedAt && {
        fromDate: before.fetchedAt,
        toDate: after.fetchedAt,
      }),
    earlierVerified: earlier.size,
    laterVerified: later.size,
    comparable,
    changed: publishable ? changed : null,
    observedRate: publishable ? changed / comparable : null,
    ...(byModel.length && { byModel }),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const aggregate = args[0] === '--aggregate';
  const [beforePath, afterPath, outputPath] = aggregate ? args.slice(1) : args;
  if (!beforePath || !afterPath || !outputPath)
    throw new Error(
      'Usage: node scripts/diff-vehicle-observations.mjs [--aggregate] before.json after.json output.json',
    );
  const before = JSON.parse(await readFile(beforePath, 'utf8'));
  const after = JSON.parse(await readFile(afterPath, 'utf8'));
  const result = aggregate
    ? summarizeObservedEngineChanges(before, after)
    : { changes: compareObservedEngines(before, after) };
  await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    JSON.stringify(
      'comparable' in result ? result : { changes: result.changes.length },
    ),
  );
}
