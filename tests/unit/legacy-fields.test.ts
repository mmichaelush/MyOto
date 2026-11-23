import { expect, test } from 'vitest';
import legacy from '../../index.html?raw';
import { fieldLabels } from '../../src/domain/format';

test('retains the labelled field inventory from the published legacy report', () => {
  const dictionary = /const FIELD_LABELS = \{([\s\S]+?)\n\s*\};/.exec(
    legacy,
  )?.[1];
  expect(dictionary).toBeDefined();
  const keys = [
    ...(dictionary ?? '').matchAll(/^\s*['"]([\w ]+)['"]:\s*\{/gm),
  ].map((match) => match[1]);
  expect(keys.length).toBeGreaterThan(100);
  expect(keys.filter((key) => !Object.hasOwn(fieldLabels, key))).toEqual([]);
});
