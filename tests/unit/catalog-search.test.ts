import { expect, test } from 'vitest';
import {
  catalogResultYear,
  normalizeCatalogTerm,
  rankCatalog,
  type CatalogFacetIndex,
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

test('combined facets require a jointly observed trim and ownership', () => {
  const model: CatalogSearchItem = {
    path: 'toyota/corolla',
    make: 'טויוטה',
    name: 'COROLLA',
    aliases: ['קורולה'],
    search: 'toyota corolla טויוטה קורולה',
    years: [2016, 2017],
    active: 300,
  };
  const index: CatalogFacetIndex = {
    [model.path]: {
      trims: [['gli', [2016, 2017]]],
      ownership: [
        ['השכרה', [2016, 2017]],
        ['פרטי', [2016, 2017]],
      ],
      ownershipByTrim: [['gli', 'פרטי', [2016]]],
    },
  };
  const privateGli = { trim: 'GLI', ownership: 'פרטי', index };
  expect(
    rankCatalog([model], '', '', undefined, {
      trim: 'gli',
      ownership: 'השכרה',
      index,
    }),
  ).toEqual([]);
  expect(rankCatalog([model], '', '', 2017, privateGli)).toEqual([]);
  expect(rankCatalog([model], '', '', 2016, privateGli)).toEqual([model]);
  expect(catalogResultYear(model, privateGli)).toBe(2016);
});
