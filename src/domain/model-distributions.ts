import type { ModelSpecification, Variant } from '../data/catalog';

export type Distribution = [string, number][];
export const unknownSpecification = 'לא סווג במקור';

export function fleetDistribution(
  rows: Variant[],
  read: (spec: ModelSpecification) => string | null | undefined,
): Distribution {
  const groups = new Map<string, number>();
  for (const row of rows) {
    if (!row.active) continue;
    const options = new Set(
      row.variants.map((variant) => {
        const value = read(variant)?.trim();
        return value && !value.startsWith('לא ידוע')
          ? value
          : unknownSpecification;
      }),
    );
    const label = options.size === 1 ? [...options][0] : unknownSpecification;
    groups.set(label, (groups.get(label) ?? 0) + row.active);
  }
  return [...groups].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he'),
  );
}
