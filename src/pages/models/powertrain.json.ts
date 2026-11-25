import { catalog } from '../../data/catalog';
import { normalizedPowertrain } from '../../data/catalog-powertrain';
import type { PowertrainIndex } from '../../presentation/catalog-search';

export function GET() {
  const index: PowertrainIndex = {};
  for (const make of catalog.makes)
    for (const model of make.models) {
      const groups = new Map<string, Set<number>>();
      for (const row of model.records)
        for (const spec of row.variants) {
          const labels = normalizedPowertrain(spec);
          if (!labels.slice(1).some(Boolean)) continue;
          const key = JSON.stringify(labels);
          const years = groups.get(key) ?? new Set<number>();
          years.add(row.year);
          groups.set(key, years);
        }
      if (groups.size)
        index[`${make.id}/${model.id}`] = [...groups].map(([key, years]) => [
          JSON.parse(key),
          [...years],
        ]);
    }
  return Response.json(index);
}
