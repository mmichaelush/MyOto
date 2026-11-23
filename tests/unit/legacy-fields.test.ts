import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { fieldLabels } from '../../src/domain/format';

test('retains the labelled field inventory from the published legacy report', () => {
  const legacy = readFileSync(
    new URL('../../index.html', import.meta.url),
    'utf8',
  );
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
