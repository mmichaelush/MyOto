import snapshot from './catalog.json' with { type: 'json' };

export const catalog = snapshot;
export type Make = (typeof catalog.makes)[number];
export type Model = Make['models'][number];
export type Variant = Model['records'][number];

export function totals(rows: Variant[]) {
  return rows.reduce(
    (sum, row) => ({
      active: sum.active + row.active,
      inactive: sum.inactive + row.inactive,
    }),
    { active: 0, inactive: 0 },
  );
}

export function years(model: Model) {
  return [...new Set(model.records.map((row) => row.year))].sort(
    (a, b) => b - a,
  );
}

export const count = new Intl.NumberFormat('he-IL');
