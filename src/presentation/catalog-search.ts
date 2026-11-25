export type CatalogSearchItem = {
  path: string;
  make: string;
  name: string;
  aliases: string[];
  search: string;
  years: number[];
  active: number;
};

export type CatalogFacetIndex = Record<
  string,
  {
    trims?: [string, number[]][];
    ownership?: [string, number[]][];
    ownershipByTrim?: [string, string, number[]][];
  }
>;

export type PowertrainIndex = Record<
  string,
  [labels: string[], years: number[]][]
>;
type CatalogFilters = {
  powertrain?: string[];
  powertrainIndex?: PowertrainIndex;
  trim?: string;
  ownership?: string;
  index?: CatalogFacetIndex;
};

export const normalizeCatalogTerm = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[־–—-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

function ownershipYears(path: string, filters: CatalogFilters) {
  const { trim, ownership } = filters;
  const data = filters.index?.[path];
  if (trim && ownership)
    return (
      data?.ownershipByTrim?.find(
        ([t, o]) => t === trim && o === ownership,
      )?.[2] ?? []
    );
  if (trim) return data?.trims?.find(([label]) => label === trim)?.[1] ?? [];
  if (ownership)
    return data?.ownership?.find(([label]) => label === ownership)?.[1] ?? [];
}

function filterYears(path: string, filters: CatalogFilters) {
  const ownership = ownershipYears(path, filters);
  if (!filters.powertrain?.some(Boolean)) return ownership;
  const required = [filters.trim ?? '', ...filters.powertrain];
  const matches = new Set(
    (filters.powertrainIndex?.[path] ?? []).flatMap(([labels, years]) =>
      required.every((value, index) => !value || labels[index] === value)
        ? years
        : [],
    ),
  );
  return ownership
    ? ownership.filter((year) => matches.has(year))
    : [...matches];
}

export function catalogResultYear(
  entry: CatalogSearchItem,
  filters: CatalogFilters,
) {
  const matchingYears = filterYears(entry.path, normalizeFilters(filters));
  return matchingYears?.length === 1 ? matchingYears[0] : undefined;
}

const normalizeFilters = ({
  trim,
  ownership,
  index,
  powertrain,
  powertrainIndex,
}: CatalogFilters) => ({
  powertrain: powertrain?.map(normalizeCatalogTerm),
  powertrainIndex,
  trim: normalizeCatalogTerm(trim ?? ''),
  ownership: normalizeCatalogTerm(ownership ?? ''),
  index,
});

export function rankCatalog(
  items: CatalogSearchItem[],
  query: string,
  make: string,
  year?: number,
  facets: CatalogFilters = {},
) {
  const terms = normalizeCatalogTerm(query).split(' ').filter(Boolean);
  const queryText = terms.join(' ');
  const filters = normalizeFilters(facets);
  const results = items.flatMap((entry) => {
    if (
      (make && !entry.path.startsWith(make + '/')) ||
      (year && !entry.years.includes(year)) ||
      terms.some((term) => !entry.search.includes(term))
    )
      return [];
    const matchingYears = filterYears(entry.path, filters);
    if (
      matchingYears &&
      !(year ? matchingYears.includes(year) : matchingYears.length)
    )
      return [];
    const names = [entry.name, ...entry.aliases].map(normalizeCatalogTerm);
    const maker = normalizeCatalogTerm(entry.make);
    const labels = [...names, ...names.map((name) => maker + ' ' + name)];
    const rank = !queryText
      ? 0
      : labels.includes(queryText)
        ? 3
        : labels.some((name) => name.startsWith(queryText))
          ? 2
          : names.some((name) => name.includes(queryText))
            ? 1
            : 0;
    return [{ entry, rank }];
  });
  return results
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        b.entry.active - a.entry.active ||
        a.entry.path.localeCompare(b.entry.path),
    )
    .map((result) => result.entry);
}
