import { expect, test } from 'vitest';
import { compareObservedEngines } from '../../scripts/diff-vehicle-observations.mjs';

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
