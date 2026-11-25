import { expect, test } from 'vitest';
import { csvBlob } from '../../src/ui/csv';

test('preserves CSV column boundaries and prevents formulas in text cells', async () => {
  const text = await csvBlob([
    ['שם', 'ספירה'],
    ['"דגם", א', 17],
    [' =2+2', 0],
  ]).text();
  expect(text).toBe(`"שם","ספירה"\r\n"""דגם"", א",17\r\n"' =2+2",0`);
});
