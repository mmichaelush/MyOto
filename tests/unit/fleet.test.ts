import { expect, test } from 'vitest';
import type { Make, Variant } from '../../src/data/catalog';
import { activeShare, fleetCells, groupFleet } from '../../src/domain/fleet';

const variant = (
  year: number,
  type: string,
  active: number,
  inactive: number,
): Variant => ({
  id: 'fixture',
  code: 1,
  name: 'fixture',
  year,
  type,
  active,
  inactive,
  variants: [],
});

test('aggregates the registry counts once and filters all requested dimensions', () => {
  const makes: Make[] = [
    {
      id: 'a',
      name: 'A',
      models: [
        {
          id: 'a1',
          name: 'A1',
          aliases: [],
          records: [variant(2023, 'P', 9, 1), variant(2023, 'M', 3, 1)],
        },
        {
          id: 'a2',
          name: 'A2',
          aliases: [],
          records: [variant(2023, 'P', 3, 3)],
        },
      ],
    },
    {
      id: 'b',
      name: 'B',
      models: [
        {
          id: 'b1',
          name: 'B1',
          aliases: [],
          records: [variant(2023, 'P', 2, 0), variant(2024, 'P', 6, 0)],
        },
      ],
    },
  ];
  const cells = fleetCells(makes);
  expect(cells).toHaveLength(4);
  expect(
    groupFleet(cells, { make: '', year: '2023', type: 'P', group: 'make' }),
  ).toEqual([
    { key: 'a', active: 12, inactive: 4 },
    { key: 'b', active: 2, inactive: 0 },
  ]);
  const [result] = groupFleet(cells, {
    make: 'a',
    year: '',
    type: '',
    group: 'year',
  });
  expect(result).toEqual({ key: '2023', active: 15, inactive: 5 });
  expect(activeShare(result)).toBe(0.75);
  expect(activeShare({ active: 0, inactive: 0 })).toBeUndefined();
});
