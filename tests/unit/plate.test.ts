import { describe, expect, test } from 'vitest';
import { formatPlate, parsePlate } from '../../src/domain/plate';

describe('registration input', () => {
  test('retains leading zeros and accepts pasted separators', () => {
    expect(parsePlate(' 01–234-56 ')).toBe('0123456');
    expect(formatPlate('0123456')).toBe('01-234-56');
    expect(formatPlate('12345678')).toBe('123-45-678');
  });
  test.each(['123', '012345678', '00000000', '12x34567'])(
    'rejects %s',
    (value) => {
      expect(parsePlate(value)).toBeUndefined();
    },
  );
});
