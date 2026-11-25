import { specialtySources } from '../domain/specialty-catalog';
import { registrationYears } from '../data/registrations';
import { engines } from '../data/engine-catalog';
import { catalog, years } from '../data/catalog';

export function GET() {
  const base = new URL(
    import.meta.env.BASE_URL + 'models/',
    'https://mmichaelush.github.io',
  );
  const paths = [
    '',
    ...catalog.makes.flatMap((make) => [
      make.id + '/',
      ...make.models.flatMap((model) => {
        const path = make.id + '/' + model.id + '/';
        return [path, ...years(model).map((year) => path + year + '/')];
      }),
    ]),
  ];
  const tools = [
    'fleet/',
    ...Object.keys(specialtySources).map(
      (source) => 'vehicle-catalogs/' + source + '/',
    ),
    'electric/',

    ...registrationYears.map((year) => 'registrations/' + year + '/'),
    'engines/',
    'engine-changes/',
    ...engines
      .filter(({ observed }) => observed > 0)
      .map(({ id }) => 'engines/' + id + '/'),
    'buying-guide/',
    'compare-models/',
    'glossary/',
    'garages/',
    'dealers/',
    'recalls/',
    'importers/',
    'licensing-fees/',
    'inspection-fees/',
    'vehicle-cost/',
    'depreciation/',
    'charging-cost/',
    'tire-size/',
    'tires/',
  ];
  const urls = [...paths, ...tools.map((path) => '../' + path)]
    .map((path) => `<url><loc>${new URL(path, base).href}</loc></url>`)
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
}
