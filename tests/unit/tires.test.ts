import { expect, test } from 'vitest';
import { parseTireSize, tireGeometry } from '../../src/domain/tires';

test('computes metric radial dimensions and rejects incomplete or invalid dimensions', () => {
  const size = parseTireSize('205/55 r16');
  expect(size).toEqual({ width: 205, aspect: 55, rim: 16 });
  const geometry = tireGeometry(size!);
  expect(geometry.sidewall).toBeCloseTo(112.75);
  expect(geometry.diameter).toBeCloseTo(631.9);
  expect(geometry.circumference).toBeCloseTo(1985.17);
  expect(parseTireSize('185R14C')).toBeUndefined();
  expect(parseTireSize('205/00R16')).toBeUndefined();
  expect(parseTireSize('900/50R16')).toBeUndefined();
});
