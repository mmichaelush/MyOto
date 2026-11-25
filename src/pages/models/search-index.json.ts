import { catalog, totals, years } from '../../data/catalog';
import {
  normalizeCatalogTerm,
  type CatalogSearchItem,
} from '../../presentation/catalog-search';

export function GET() {
  const index = catalog.makes.flatMap((make) =>
    make.models.map((model): CatalogSearchItem => {
      const modelYears = years(model);
      const trims = new Set(
        model.records.flatMap((row) =>
          row.variants.map(([trim]) => trim).filter(Boolean),
        ),
      );
      const search = normalizeCatalogTerm(
        [make.name, make.id, model.name, ...model.aliases, ...trims].join(' '),
      );
      return {
        path: `${make.id}/${model.id}`,
        make: make.name,
        name: model.name,
        aliases: model.aliases,
        active: totals(model.records).active,
        search,
        years: modelYears,
      };
    }),
  );
  return Response.json(index);
}
