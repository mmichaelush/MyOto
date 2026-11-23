import { catalog, totals, years } from '../../data/catalog';
import { cohorts } from '../../data/cohorts';
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
      const path = `${make.id}/${model.id}`;
      const groupYears = (pairs: Iterable<readonly [string, number]>) => {
        const groups = new Map<string, Set<number>>();
        for (const [label, year] of pairs) {
          const group = groups.get(label) ?? new Set<number>();
          group.add(year);
          groups.set(label, group);
        }
        return [...groups].map(([label, years]): [string, number[]] => [
          label,
          [...years],
        ]);
      };
      const specs = groupYears(
        model.records.flatMap((row) =>
          row.variants.flatMap(([name]) =>
            name?.trim() ? [[name.trim(), row.year] as const] : [],
          ),
        ),
      );
      const sampledOwnership = groupYears(
        modelYears.flatMap((year) =>
          (cohorts[path + '/' + year]?.ownership ?? []).flatMap(
            ([name, count]) => (count > 0 ? [[name, year] as const] : []),
          ),
        ),
      );
      const search = normalizeCatalogTerm(
        [make.name, make.id, model.name, ...model.aliases, ...trims].join(' '),
      );
      return {
        path,
        make: make.name,
        name: model.name,
        aliases: model.aliases,
        active: totals(model.records).active,
        search,
        years: modelYears,
        ...(specs.length ? { trims: specs } : {}),
        ...(sampledOwnership.length ? { sampledOwnership } : {}),
      };
    }),
  );
  return Response.json(index);
}
