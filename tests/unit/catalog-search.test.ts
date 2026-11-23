import { expect, test } from 'vitest';
import {
  normalizeCatalogTerm,
  rankCatalog,
  type CatalogSearchItem,
} from '../../src/presentation/catalog-search';

test('prioritizes exact alias and applies model year and maker as independent filters', () => {
  const items: CatalogSearchItem[] = [
    {
      path: 'toyota/corolla-cross',
      make: 'טויוטה',
      name: 'COROLLA CROSS',
      aliases: ['קורולה קרוס'],
      search: 'toyota corolla cross טויוטה קורולה קרוס',
      years: [2023],
      active: 999,
    },
    {
      path: 'toyota/corolla',
      make: 'טויוטה',
      name: 'COROLLA',
      aliases: ['קורולה'],
      search: 'toyota corolla טויוטה קורולה',
      years: [2021, 2023],
      active: 45,
    },
  ];
  expect(
    rankCatalog(items, 'קורולה', 'toyota', 2023).map((item) => item.path),
  ).toEqual(['toyota/corolla', 'toyota/corolla-cross']);
  expect(rankCatalog(items, 'COROLLA', 'toyota', 2021)).toEqual([items[1]]);
  expect(rankCatalog(items, 'קורולה', 'other')).toEqual([]);
  expect(normalizeCatalogTerm('  RAV–4 ')).toBe('rav 4');
});
