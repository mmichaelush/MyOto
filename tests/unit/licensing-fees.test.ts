import { expect, test } from 'vitest';
import { annualBaseFee, feeSchedules } from '../../src/domain/licensing-fees';

test.each([
  [1, 2024, 1266],
  [1, 2023, 1109],
  [1, 2021, 1109],
  [1, 2020, 972],
  [1, 2017, 972],
  [1, 2016, 849],
  [7, 2026, 5364],
  [0, 2026, undefined],
  [1, 2027, undefined],
])('looks up group %i and year %i', (group, year, expected) => {
  expect(annualBaseFee({ kind: 'light', group, year })).toBe(expected);
});

test('calculates base fees for motorcycles, heavy vehicles and collectors', () => {
  expect(annualBaseFee({ kind: 'motorcycle', band: 1 })).toBe(194);
  expect(annualBaseFee({ kind: 'motorcycle', band: 3 })).toBe(52);
  expect(annualBaseFee({ kind: 'heavy', band: 2 })).toBe(3964);
  expect(annualBaseFee({ kind: 'heavy', band: 3 })).toBe(452);
  expect(annualBaseFee({ kind: 'collector' })).toBe(265);
});

test('uses the selected schedule for historical year bands and vehicle types', () => {
  const schedule = feeSchedules['2025'];
  for (const [year, expected] of [
    [2015, 827],
    [2016, 947],
    [2019, 947],
    [2020, 1080],
    [2022, 1080],
    [2023, 1233],
    [2025, 1233],
  ] as const) {
    expect(annualBaseFee({ kind: 'light', group: 1, year }, schedule)).toBe(
      expected,
    );
  }
  expect(
    annualBaseFee({ kind: 'light', group: 1, year: 2026 }, schedule),
  ).toBeUndefined();
  expect(annualBaseFee({ kind: 'motorcycle', band: 2 }, schedule)).toBe(348);
  expect(annualBaseFee({ kind: 'heavy', band: 2 }, schedule)).toBe(3862);
  expect(annualBaseFee({ kind: 'collector' }, schedule)).toBe(258);
});

test('calculates bus, taxi and tractor rates for both schedules', () => {
  expect(annualBaseFee({ kind: 'bus', band: 1 })).toBe(1214);
  expect(annualBaseFee({ kind: 'taxi', band: 3 }, feeSchedules['2025'])).toBe(
    1224,
  );
  expect(
    annualBaseFee({ kind: 'tractor', band: 0 }, feeSchedules['2025']),
  ).toBe(266);
});
