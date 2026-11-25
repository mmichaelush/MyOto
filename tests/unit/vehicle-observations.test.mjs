import { expect, test } from 'vitest';
import {
  compareObservedEngines,
  summarizeObservedEngineChanges,
} from '../../scripts/diff-vehicle-observations.mjs';

const row = {
  vin: 'JTNFAKE1123456789',
  plate: '11234567',
  engine: 'ABC111',
  verified: true,
};
const old = { month: '2026-09', rows: [row] };
const month = (...rows) => ({ month: '2026-11', rows });

test('reports an engine-number change as an observation interval', () => {
  expect(
    compareObservedEngines(old, month({ ...row, engine: 'DEF 222' })),
  ).toEqual([
    {
      vin: row.vin,
      plate: row.plate,
      previousEngine: 'ABC111',
      currentEngine: 'DEF222',
      previousObservation: '2026-09',
      observedChangeBy: '2026-11',
    },
  ]);
});

test('ignores corrections in formatting, plate replacement, and conflicting records', () => {
  expect(
    compareObservedEngines(old, month({ ...row, engine: 'abc 111' })),
  ).toEqual([]);
  expect(
    compareObservedEngines(
      old,
      month({ ...row, plate: '99999123', engine: 'DEF222' }),
    ),
  ).toEqual([]);
  expect(
    compareObservedEngines(old, month({ ...row, engine: 'DEF222' }, row)),
  ).toEqual([]);
  expect(
    compareObservedEngines(
      old,
      month({ ...row, engine: 'DEF222', verified: false }),
    ),
  ).toEqual([]);
  expect(() => compareObservedEngines(old, old)).toThrow();
});

test('ignores a plate claimed by two different VINs in one observation month', () => {
  expect(
    compareObservedEngines(
      old,
      month(
        { ...row, engine: 'DEF222' },
        { ...row, vin: 'JTNFAKE2123456789', engine: 'XYZ333' },
      ),
    ),
  ).toEqual([]);
});

test('exports an identity-free interval summary and suppresses small results', () => {
  expect(
    summarizeObservedEngineChanges(old, month({ ...row, engine: 'DEF222' })),
  ).toMatchObject({ comparable: 1, changed: null, observedRate: null });
  const rows = Array.from({ length: 24 }, (_, index) => ({
    ...row,
    vin: row.vin.slice(0, -2) + String(index).padStart(2, '0'),
    plate: String(11234000 + index),
  }));
  const next = rows.map((entry, index) =>
    index < 6 ? { ...entry, engine: 'DEF222' } : entry,
  );
  const result = summarizeObservedEngineChanges(
    { ...old, rows },
    month(...next),
  );
  expect(result).toEqual({
    schema: 1,
    from: '2026-09',
    to: '2026-11',
    earlierVerified: 24,
    laterVerified: 24,
    comparable: 24,
    changed: 6,
    observedRate: 0.25,
  });
  expect(JSON.stringify(result)).not.toMatch(/DEF222|11234000|JTNFAKE/);
});
