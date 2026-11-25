import { expect, test } from 'vitest';
import { engineSlug, normalizeEngineCode } from '../../src/domain/engine-code';

test('normalizes presentation variants while keeping distinct registry codes distinct', () => {
  expect(normalizeEngineCode('  ２zr-fxe ')).toBe('2ZR-FXE');
  expect(normalizeEngineCode('  abc   23 ')).toBe('ABC 23');
  expect(normalizeEngineCode('/')).toBeUndefined();
  expect(normalizeEngineCode('<svg>')).toBeUndefined();
  expect(engineSlug('AB/12')).not.toBe(engineSlug('AB-12'));
  expect(engineSlug('AB/12')).toBe('ab~2f12');
});
