import { catalog, years } from '../../data/catalog';

export type CatalogSearchItem = {
  path: string;
  make: string;
  name: string;
  search: string;
  years: number[];
};

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
      const search = [
        make.name,
        make.id,
        model.name,
        ...model.aliases,
        ...modelYears,
        ...trims,
      ]
        .join(' ')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[-–—]/g, ' ');
      return {
        path,
        make: make.name,
        name: model.name,
        search,
        years: modelYears,
      };
    }),
  );
  return Response.json(index);
}
