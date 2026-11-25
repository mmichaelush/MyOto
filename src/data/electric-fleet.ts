import source from './electric-fleet.json' with { type: 'json' };

export type ElectricRow = [
  district: string,
  subdistrict: string,
  ownership: string,
  count: number,
];
export const electricFleet = { ...source, rows: source.rows as ElectricRow[] };
export const electricFleetTotal = electricFleet.rows.reduce(
  (sum, row) => sum + row[3],
  0,
);
const grouped = new Map<string, ElectricRow[]>();
for (const row of electricFleet.rows) {
  const entries = grouped.get(row[0]) ?? [];
  entries.push(row);
  grouped.set(row[0], entries);
}
export const electricDistricts = [...grouped]
  .map(([district, rows]) => ({
    district,
    rows: rows.sort((a, b) => b[3] - a[3]),
    total: rows.reduce((sum, row) => sum + row[3], 0),
  }))
  .sort((a, b) => b.total - a.total);
