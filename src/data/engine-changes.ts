import { engineSnapshot } from './engine-catalog';

export const retiredByYear = new Map<
  string,
  [string, string, string, string, number][]
>();
for (const [code, groups] of engineSnapshot.retired ?? []) {
  for (const [year, engineMaker, make, model, count] of groups) {
    const values = retiredByYear.get(year) ?? [];
    values.push([make, model, code, engineMaker, count]);
    retiredByYear.set(year, values);
  }
}
export const retiredYears = [...retiredByYear.keys()].sort(
  (a, b) => Number(b) - Number(a),
);

type Summary = {
  from: string;
  to: string;
  fromDate?: string;
  toDate?: string;
  comparable: number;
  changed: number | null;
  byModel?: {
    make?: string;
    model?: string;
    vehicleMaker?: string;
    vehicleModel?: string;
    engineModel: string;
    comparable: number;
    changed: number;
    observedKm?: number | null;
  }[];
};
const summaries = import.meta.glob<Summary>('./engine-changes/*.json', {
  eager: true,
  import: 'default',
});
export const engineChangePeriods = Object.entries(summaries)
  .map(([path, summary]) => ({
    fleet: path.includes('/private-') ? 'פרטי ומסחרי קל' : 'רכב כבד',
    from: summary.from,
    to: summary.to,
    fromDate: summary.fromDate,
    toDate: summary.toDate,
    comparable: summary.comparable,
    changed: summary.changed,
    rows: (summary.byModel ?? []).map((row) => ({
      make: row.make ?? row.vehicleMaker ?? '',
      model: row.model ?? row.vehicleModel ?? '',
      code: row.engineModel,
      comparable: row.comparable,
      changed: row.changed,
      observedKm: row.observedKm ?? null,
    })),
  }))
  .sort(
    (a, b) => b.to.localeCompare(a.to) || a.fleet.localeCompare(b.fleet, 'he'),
  );
