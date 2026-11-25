import snapshot from './engine-catalog.json?raw';
import { catalog } from './catalog';
import { engineSlug } from '../domain/engine-code';

type RetiredGroup = [
  year: string,
  engineMaker: string,
  vehicleMaker: string,
  vehicleModel: string,
  rows: number,
];

type EngineSnapshot = {
  schema: number;
  retired?: [code: string, groups: RetiredGroup[]][];
  updatedAt: string;
  fetchedAt: string;
  population: number;
  sampled: number;
  skipped: number;
  entries: [code: string, variants: [key: string, observations: number][]][];
};

export const engineSnapshot: EngineSnapshot = JSON.parse(snapshot);
const variantIndex = new Map(
  catalog.makes.flatMap((make) =>
    make.models.flatMap((model) =>
      model.records.map((row) => [row.id, { make, model, row }] as const),
    ),
  ),
);

const activeByCode = new Map(engineSnapshot.entries);
const retiredByCode = new Map(engineSnapshot.retired ?? []);
export const engines = [
  ...new Set([...activeByCode.keys(), ...retiredByCode.keys()]),
]
  .sort((a, b) => a.localeCompare(b, 'en'))
  .map((code) => {
    const variants = activeByCode.get(code) ?? [];
    const retired = retiredByCode.get(code) ?? [];
    return {
      code,
      id: engineSlug(code),
      variants,
      retired,
      observed: variants.reduce((total, [, count]) => total + count, 0),
      retiredCount: retired.reduce((total, group) => total + group[4], 0),
    };
  });

const byVariant = new Map<string, Set<(typeof engines)[number]>>();
for (const engine of engines) {
  for (const [key] of engine.variants) {
    const indexed = byVariant.get(key) ?? new Set();
    indexed.add(engine);
    byVariant.set(key, indexed);
  }
}

export function engineCodesForKeys(keys: Iterable<string>) {
  const found = new Set<(typeof engines)[number]>();
  for (const key of keys) {
    for (const engine of byVariant.get(key) ?? []) found.add(engine);
  }
  return [...found].sort((a, b) => a.code.localeCompare(b.code, 'en'));
}

export function engineModels(engine: (typeof engines)[number]) {
  const models = new Map<
    string,
    {
      make: string;
      model: string;
      path: string;
      year: number;
      observed: number;
    }
  >();
  let unlinked = 0;
  for (const [key, observed] of engine.variants) {
    const match = variantIndex.get(key);
    if (!match) {
      unlinked += observed;
      continue;
    }
    const { make, model, row } = match;
    const path = [make.id, model.id, row.year].join('/') + '/';
    const entry = models.get(path) ?? {
      make: make.name,
      model: model.name,
      path,
      year: row.year,
      observed: 0,
    };
    entry.observed += observed;
    models.set(path, entry);
  }
  return {
    unlinked,
    rows: [...models.values()].sort(
      (a, b) =>
        b.year - a.year ||
        b.observed - a.observed ||
        a.path.localeCompare(b.path),
    ),
  };
}
