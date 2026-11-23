import snapshot from './catalog.json?raw';

export type Variant = {
  id: string;
  year: number;
  code: number;
  type: string;
  name: string;
  active: number;
  inactive: number;
  variants: [string | null, string | null, number | null, number | null][];
};
export type Model = {
  id: string;
  name: string;
  aliases: string[];
  records: Variant[];
};
export type Make = { id: string; name: string; models: Model[] };
type Catalog = {
  updatedAt: string;
  fetchedAt: string;
  excluded?: number;
  makes: Make[];
};
export const catalog: Catalog = JSON.parse(snapshot);

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

export function totalsByYear(rows: Variant[]) {
  const byYear = new Map<
    number,
    { year: number; active: number; inactive: number }
  >();
  for (const row of rows) {
    const total = byYear.get(row.year) ?? {
      year: row.year,
      active: 0,
      inactive: 0,
    };
    total.active += row.active;
    total.inactive += row.inactive;
    byYear.set(row.year, total);
  }
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

export const count = new Intl.NumberFormat('he-IL');
