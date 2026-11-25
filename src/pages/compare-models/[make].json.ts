import type { APIRoute } from 'astro';
import { catalog, totals, years } from '../../data/catalog';
import { cohorts, fetchedAt } from '../../data/cohorts';
import { engineCodesForKeys } from '../../data/engine-catalog';

export function getStaticPaths() {
  return catalog.makes.map((make) => ({
    params: { make: make.id },
    props: { make },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const { make } = props as { make: (typeof catalog.makes)[number] };
  return Response.json(
    Object.fromEntries(
      make.models.map((model) => [
        model.id,
        Object.fromEntries(
          years(model).map((year) => {
            const rows = model.records.filter((row) => row.year === year);
            const specs = rows.flatMap((row) => row.variants);
            const labels = (values: unknown[]) =>
              [
                ...new Set(
                  values
                    .filter((value) => value != null && value !== '')
                    .map(String),
                ),
              ].sort((a, b) => a.localeCompare(b, 'he', { numeric: true }));
            const cohort = cohorts[`${make.id}/${model.id}/${year}`];
            const sample = cohort?.mileage;
            const engineRows = new Map<
              string,
              { observed: number; ambiguous: boolean; specs: typeof specs }
            >();
            for (const row of rows) {
              const matches = engineCodesForKeys([row.id]);
              for (const engine of matches) {
                const entry = engineRows.get(engine.code) ?? {
                  observed: 0,
                  ambiguous: false,
                  specs: [],
                };
                entry.observed +=
                  engine.variants.find(([code]) => code === row.id)?.[1] ?? 0;
                if (matches.length === 1) entry.specs.push(...row.variants);
                else entry.ambiguous = true;
                engineRows.set(engine.code, entry);
              }
            }
            return [
              year,
              {
                counts: totals(rows),
                fuels: labels(specs.map(([, fuel]) => fuel)),
                displacement: labels(specs.map(([, , cc]) => cc)),
                drive: labels(specs.map(([, , , , extra]) => extra?.drive)),
                country: labels(specs.map(([, , , , extra]) => extra?.country)),
                feeGroup: labels(
                  specs.map(([, , , , extra]) =>
                    typeof extra?.feeGroup === 'number' &&
                    extra.feeGroup >= 1 &&
                    extra.feeGroup <= 7
                      ? extra.feeGroup
                      : undefined,
                  ),
                ),
                safety: labels(specs.map(([, , , , extra]) => extra?.safety)),
                engines: [...engineRows]
                  .sort(([a], [b]) => a.localeCompare(b, 'en'))
                  .map(([code, entry]) => ({
                    code,
                    observed: entry.observed,
                    fuels: entry.ambiguous
                      ? []
                      : labels(entry.specs.map(([, fuel]) => fuel)),
                    displacement: entry.ambiguous
                      ? []
                      : labels(entry.specs.map(([, , cc]) => cc)),
                    drive: entry.ambiguous
                      ? []
                      : labels(
                          entry.specs.map(([, , , , extra]) => extra?.drive),
                        ),
                  })),
                mileage: sample
                  ? {
                      median: sample.median,
                      n: sample.n,
                      date: (cohort?.fetchedAt ?? fetchedAt).slice(0, 10),
                    }
                  : null,
              },
            ];
          }),
        ),
      ]),
    ),
  );
};
