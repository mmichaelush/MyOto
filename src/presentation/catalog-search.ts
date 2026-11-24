export type CatalogSearchItem = {
  path: string;
  make: string;
  name: string;
  aliases: string[];
  search: string;
  years: number[];
  active: number;
};

export const normalizeCatalogTerm = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[־–—-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export function rankCatalog(
  items: CatalogSearchItem[],
  query: string,
  make: string,
  year?: number,
) {
  const terms = normalizeCatalogTerm(query).split(' ').filter(Boolean);
  const queryText = terms.join(' ');
  const results = items.flatMap((entry) => {
    if (
      (make && !entry.path.startsWith(make + '/')) ||
      (year && !entry.years.includes(year)) ||
      terms.some((term) => !entry.search.includes(term))
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
