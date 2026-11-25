import { expect, test } from 'vitest';
import {
  mileagePercentileRange,
  mileageSummary,
  sampleWindows,
} from '../../src/domain/statistics';

test('centers disjoint samples across all strata, or selects the whole small cohort', () => {
  expect(sampleWindows(100, 20, 4)).toEqual(
    [10, 35, 60, 85].map((offset) => ({ offset, limit: 5 })),
  );
  expect(sampleWindows(3, 20, 4)).toEqual([{ offset: 0, limit: 3 }]);
  expect(sampleWindows(0, 20, 4)).toEqual([]);
});

test('interpolates quartiles and permanently discards disagreeing readings', () => {
  const rows = [10, 20, 30, 40].map(
    (km, plate): { mispar_rechev: number; kilometer_test_aharon: unknown } => ({
      mispar_rechev: plate,
      kilometer_test_aharon: km,
    }),
  );
  for (const km of [90, 100, 90, 0, '100', 2_000_001])
    rows.push({ mispar_rechev: 9, kilometer_test_aharon: km });
  expect(mileageSummary(rows, 1)).toEqual({
    n: 4,
    p25: 18,
    median: 25,
    p75: 33,
  });
  expect(mileageSummary(rows, 5)).toBeNull();
});

test('publishes grouped mileage bounds with at least five observations per band', () => {
  const rows = Array.from({ length: 22 }, (_, index) => ({
    mispar_rechev: index + 1,
    kilometer_test_aharon: index < 10 ? 10000 : index < 20 ? 30000 : 90000,
  }));
  const summary = mileageSummary(rows, 20, true);
  expect(summary?.bands).toEqual([
    [20000, 10],
    [100000, 12],
  ]);
  expect(mileagePercentileRange(30000, summary!.bands!, 22)).toEqual([45, 100]);
});
