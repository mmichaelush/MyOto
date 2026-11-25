import { expect, test } from 'vitest';
import type { Variant } from '../../src/data/catalog';
import {
  fleetDistribution,
  unknownSpecification,
} from '../../src/domain/model-distributions';

test('assigns registry counts only to consistent model classifications', () => {
  const common = {
    id: 'P/1/2/2020',
    year: 2020,
    code: 2,
    type: 'P',
    name: 'TEST',
    inactive: 6,
  };
  const spec = (drive?: string): Variant['variants'][number] => [
    null,
    null,
    null,
    null,
    drive ? { drive } : undefined,
  ];
  const rows: Variant[] = [
    { ...common, active: 700, variants: [spec('4X2'), spec('4X2')] },
    { ...common, active: 200, variants: [spec('4X2'), spec('4X4')] },
    { ...common, active: 100, variants: [spec('4X4'), spec()] },
    { ...common, active: 0, variants: [spec('4X4')] },
  ];
  expect(fleetDistribution(rows, ([, , , , extra]) => extra?.drive)).toEqual([
    ['4X2', 700],
    [unknownSpecification, 300],
  ]);
});
