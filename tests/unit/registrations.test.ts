import { expect, test } from 'vitest';
import {
  registrationModelIndex,
  registrationComparison,
  registrationTotal,
  type RegistrationMonth,
} from '../../src/domain/registrations';

test('compares only matching months with counts from both sources', () => {
  const rows: RegistrationMonth[] = [
    [202501, 10, 5],
    [202502, 100, 0],
    [202601, 20, 10],
    [202602, 1000, null],
    [202603, 40, 0],
  ];
  expect(registrationTotal(rows[3])).toBeNull();
  expect(registrationComparison(rows, 2026)).toEqual({
    months: 1,
    currentTotal: 30,
    previousTotal: 15,
    change: 1,
  });
});

test('links keys across years only when all catalog rows identify the same model', () => {
  const index = registrationModelIndex([
    {
      id: 'make',
      models: [
        {
          id: 'first',
          records: [
            { id: 'P/1/10/2024' },
            { id: 'P/1/10/2025' },
            { id: 'P/1/20/2025' },
          ],
        },
        { id: 'second', records: [{ id: 'P/1/20/2024' }] },
      ],
    },
  ]);
  expect(index.get('P/1/10')).toBe('make/first');
  expect(index.get('P/1/20')).toBeNull();
  expect(index.get('M/1/10')).toBeUndefined();
});
