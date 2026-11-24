import { catalog, years } from '../../data/catalog';
import { cohorts } from '../../data/cohorts';
import {
  normalizeCatalogTerm,
  type CatalogFacetIndex,
} from '../../presentation/catalog-search';

function addYear(
  groups: Map<string, Set<number>>,
  label: string,
  year: number,
) {
  const values = groups.get(label) ?? new Set<number>();
  values.add(year);
  groups.set(label, values);
}

function entries(groups: Map<string, Set<number>>): [string, number[]][] {
  return [...groups].map(([label, values]) => [label, [...values]]);
}

export function GET() {
  const index: CatalogFacetIndex = {};
  for (const make of catalog.makes)
    for (const model of make.models) {
      const path = `${make.id}/${model.id}`;
      const trims = new Map<string, Set<number>>();
      const ownership = new Map<string, Set<number>>();
      const joint = new Map<string, Set<number>>();
      for (const row of model.records)
        for (const [trim] of row.variants) {
          const label = normalizeCatalogTerm(trim ?? '');
          if (label) addYear(trims, label, row.year);
        }
      for (const year of years(model)) {
        const cohort = cohorts[`${path}/${year}`];
        for (const [owner, count] of cohort?.ownership ?? []) {
          if (count >= 5 && owner !== 'קטגוריות נוספות' && owner !== 'לא ידוע')
            addYear(ownership, normalizeCatalogTerm(owner), year);
        }
        for (const [trim, owner, count] of cohort?.ownershipByTrim ?? []) {
          const trimLabel = normalizeCatalogTerm(trim);
          const ownerLabel = normalizeCatalogTerm(owner);
          if (count >= 5 && trimLabel && ownerLabel)
            addYear(joint, JSON.stringify([trimLabel, ownerLabel]), year);
        }
      }
      if (trims.size || ownership.size || joint.size)
        index[path] = {
          ...(trims.size ? { trims: entries(trims) } : {}),
          ...(ownership.size ? { ownership: entries(ownership) } : {}),
          ...(joint.size
            ? {
                ownershipByTrim: entries(joint).map(([key, matches]) => {
                  const [trim, owner]: [string, string] = JSON.parse(key);
                  return [trim, owner, matches];
                }),
              }
            : {}),
        };
    }
  return Response.json(index);
}
