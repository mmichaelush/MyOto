import snapshot from './tire-catalog.json?raw';
import { catalog } from './catalog';

type TireCatalog = {
  updatedAt: string;
  total: number;
  entries: [
    size: string,
    variants: [key: string, front: number, rear: number][],
  ][];
};

export const tireCatalog: TireCatalog = JSON.parse(snapshot);
const variants = new Map(
  catalog.makes.flatMap((make) =>
    make.models.flatMap((model) =>
      model.records.map(
        (row) =>
          [
            row.id,
            {
              make: make.name,
              model: model.name,
              year: row.year,
              path: `${make.id}/${model.id}/${row.year}/`,
            },
          ] as const,
      ),
    ),
  ),
);

export function tireModels(entries: TireCatalog['entries'][number][1]) {
  const models = new Map<
    string,
    {
      make: string;
      model: string;
      year: number;
      path: string;
      front: number;
      rear: number;
    }
  >();
  const unlinked = [0, 0];
  for (const [key, front, rear] of entries) {
    const match = variants.get(key);
    if (!match) {
      unlinked[0] += front;
      unlinked[1] += rear;
      continue;
    }
    const row = models.get(match.path) ?? { ...match, front: 0, rear: 0 };
    row.front += front;
    row.rear += rear;
    models.set(match.path, row);
  }
  return {
    rows: [...models.values()].sort(
      (a, b) =>
        b.front + b.rear - a.front - a.rear || a.path.localeCompare(b.path),
    ),
    unlinked,
  };
}
