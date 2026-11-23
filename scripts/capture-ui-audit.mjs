import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import sources from '../src/data/resources.json' with { type: 'json' };

const widths = [1440, 1366, 1024, 768, 430, 390, 360];
const cases = [
  ['home'],
  ['private', '11234567', 'private_cars_1'],
  ['motorcycle', '21234567', 'twoWheeled'],
  ['truck', '31234567', 'heavy'],
  ['bus', '41234567', 'publicTransport'],
  ['equipment', '51234567', 'cme'],
  ['cancelled', '61234567', 'offRoad_1'],
  ['partial', '71234567', 'private_cars_1'],
  ['comparison'],
  ['catalog'],
  ['model-year'],
  ['missing', '81234567'],
  ['commercial', '10234567', 'private_cars_1'],
  ['import', '20234567', 'personalImport'],
  ['frozen', '30234567', 'frozen_with_model'],
  ['recall', '40234567', 'private_cars_1'],
  ['permit', '50234567', 'private_cars_1'],
  ['ownership', '60234567', 'private_cars_1'],
  ['historic', '00123456', 'offRoad_2'],
  ['collision', '90234567', 'private_cars_1'],
];
const names = {
  private: 'טויוטה',
  motorcycle: 'הונדה',
  truck: 'וולוו',
  bus: 'מרצדס',
  equipment: 'קטרפילר',
  cancelled: 'מיצובישי',
};
const baseline = execFileSync('git', [
  'show',
  '2fadf2ed47bfce2f0848407b361f6bbf1f355608:index.html',
]);
const server = createServer((_request, res) => {
  res
    .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    .end(baseline);
});
await new Promise((resolve) => server.listen(4324, '127.0.0.1', resolve));
const mode = process.argv[2] ?? 'before';
const root = new URL('../.astro/ui-audit/', import.meta.url);
await mkdir(root, { recursive: true });
const browser = await chromium.launch();
const wanted = new Set(process.argv.slice(3));
const editions = mode === 'before' ? ['legacy', 'before'] : ['after'];
const result = [];
try {
  for (const edition of editions) {
    await mkdir(new URL(edition + '/', root), { recursive: true });
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route(
      (url) =>
        url.hostname === 'data.gov.il' &&
        url.pathname.endsWith('/datastore_search'),
      async (route) => {
        const params = new URL(route.request().url()).searchParams;
        const filter = JSON.parse(params.get('filters') ?? '{}');
        const values = Object.values(filter).flat().map(String);
        if (params.has('q')) values.push(params.get('q'));
        const fixture = cases.find(
          ([, plate]) =>
            plate && values.some((value) => Number(value) === Number(plate)),
        );
        const [kind, plate, key] = fixture ?? [];
        const resource = Object.entries(sources).find(
          ([, s]) => s.id === params.get('resource_id'),
        )?.[0];
        if (kind === 'partial' && resource === 'offRoad_2')
          return route.fulfill({
            status: 404,
            headers: { 'access-control-allow-origin': '*' },
          });
        const keyField = resource === 'cme' ? 'mispar_tzama' : 'mispar_rechev';
        const fixtureRow = {
          [keyField]: resource === 'offRoad_2' ? plate : Number(plate),
          tozeret_nm: names[kind] ?? 'טויוטה',
          kinuy_mishari:
            kind === 'motorcycle'
              ? 'CB500X'
              : kind === 'truck'
                ? 'FH 460'
                : kind === 'bus'
                  ? 'CITARO'
                  : kind === 'equipment'
                    ? '320 GC'
                    : 'COROLLA',
          degem_nm: 'E210',
          shnat_yitzur: 2021,
          ramat_gimur: 'STYLE',
          sug_delek_nm: 'בנזין',
          tozeret_cd: 500,
          degem_cd: 123,
          sug_degem: kind === 'commercial' ? 'M' : 'P',
          tokef_dt: '2027-09-26',
          mivchan_acharon_dt: '2026-09-15',
          baalut: 'פרטי',
          misgeret: 'MYOTODEMO11234567',
          mispar_manoa: 'ENG123456',
          nefach_manoa: 1798,
          koah_sus: 122,
          tzeva_rechev: 'לבן',
          automatic_ind: 1,
          mishkal_kolel: kind === 'truck' ? 26000 : 1845,
          mispar_moshavim: kind === 'bus' ? 52 : 5,
          sug_rechev_nm:
            kind === 'bus'
              ? 'אוטובוס עירוני'
              : kind === 'truck'
                ? 'משאית'
                : kind === 'motorcycle'
                  ? 'אופנוע'
                  : kind === 'equipment'
                    ? 'מחפר זחלי'
                    : 'פרטי',
          ...(kind === 'cancelled' && { bitul_dt: '2025-02-07' }),
        };
        let rows =
          resource &&
          (resource === key || (kind === 'collision' && resource === 'cme'))
            ? [fixtureRow]
            : [];
        if (kind === 'collision' && resource === 'cme')
          rows = [
            {
              mispar_tzama: Number(plate),
              tozeret_nm: 'קטרפילר',
              sug_rechev_nm: 'מחפר זחלי',
            },
          ];
        if (key === 'private_cars_1' && resource === 'history_1')
          rows = [
            {
              mispar_rechev: Number(plate),
              mispar_manoa: 'ENG123456',
              kilometer_test_aharon: 86541,
              rishum_rishon_dt: '2021-01-20',
            },
          ];
        if (key === 'private_cars_1' && resource === 'history_2')
          rows = Array.from(
            { length: kind === 'ownership' ? 30 : 3 },
            (_, i) => ({
              _id: i + 1,
              mispar_rechev: Number(plate),
              baalut: i === 1 ? 'ליסינג' : 'פרטי',
              baalut_dt: 202101 + i,
            }),
          );
        if (kind === 'recall' && resource === 'recall')
          rows = [
            {
              MISPAR_RECHEV: Number(plate),
              RECALL_ID: 501,
              TAARICH_PTICHA: '2026-10-03',
              SUG_TAKALA: 'מערכת בלימה',
              TEUR_TAKALA: 'עדכון תוכנה דרך היבואן',
            },
          ];
        if (resource === 'campaigns' && values.includes('501'))
          rows = [{ RECALL_ID: 501, OFEN_TIKUN: 'עדכון תוכנה' }];
        if (kind === 'permit' && resource === 'disabledPermit')
          rows = [
            {
              'MISPAR RECHEV': Number(plate),
              'SUG TAV': 1,
              'TAARICH HAFAKAT TAG': 20260104,
            },
          ];
        const body = { success: true, result: { limit: 50, records: rows } };
        const callback = params.get('callback');
        if (callback && /^\w+$/.test(callback)) {
          return route.fulfill({
            contentType: 'application/javascript',
            body: callback + '(' + JSON.stringify(body) + ');',
          });
        }
        await route.fulfill({
          headers: { 'access-control-allow-origin': '*' },
          json: body,
        });
      },
    );
    const queue = widths.flatMap((width) =>
      cases
        .filter(
          ([name, plate]) =>
            (edition !== 'legacy' || plate || name === 'home') &&
            (wanted.size
              ? wanted.has(name)
              : width === 1366 ||
                width === 390 ||
                [
                  'home',
                  'private',
                  'comparison',
                  'catalog',
                  'model-year',
                ].includes(name)),
        )
        .map((scenario) => [width, scenario]),
    );
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (;;) {
          const item = queue.shift();
          if (!item) return;
          const [width, [name, plate]] = item;
          const page = await context.newPage();
          try {
            await page.addInitScript(() => {
              localStorage.clear();
            });
            await page.setViewportSize({
              width,
              height: width < 500 ? 844 : 900,
            });
            const base =
              edition === 'legacy'
                ? 'http://127.0.0.1:4324/'
                : (process.env.MYOTO_PREVIEW_BASE ??
                  'http://127.0.0.1:4322/MyOto/');
            const suffix =
              name === 'comparison'
                ? 'compare/?a=11234567&b=21234567'
                : name === 'catalog'
                  ? 'models/'
                  : name === 'model-year'
                    ? 'models/mitsubishi/lancer/2010/'
                    : plate
                      ? '?search=' +
                        plate +
                        (name === 'equipment' ? '&type=equipment' : '')
                      : '';
            await page.goto(base + suffix, {
              waitUntil: 'domcontentloaded',
              timeout: 15000,
            });
            if (plate)
              await page
                .waitForFunction(
                  (selector) =>
                    document.querySelector(selector)?.textContent.trim()
                      .length > 3 &&
                    !document
                      .querySelector(selector)
                      ?.hasAttribute('aria-busy') &&
                    !document.querySelector(selector)?.querySelector('.loader'),
                  edition === 'legacy' ? '#resultsArea' : '#report',
                  { timeout: 8000 },
                )
                .catch(() => {});
            if (name === 'comparison')
              await page
                .locator('#comparison table')
                .waitFor({ timeout: 8000 })
                .catch(() => {});
            const metrics = await page.evaluate(
              (edition) => ({
                title: document.querySelector('h1')?.textContent?.trim(),
                sectionCount: document.querySelectorAll(
                  edition === 'legacy' ? '#resultsArea h4' : '#report h3',
                ).length,
                sourceLinks: [
                  ...document.querySelectorAll('#report a[href*="gov.il"]'),
                ].filter(
                  (link) =>
                    !link.closest('details:not([open])') &&
                    link.getClientRects().length,
                ).length,
                fold: Math.round(
                  document
                    .querySelector(
                      edition === 'legacy' ? '#resultsArea' : '#report',
                    )
                    ?.getBoundingClientRect().top ?? 0,
                ),
                documentWidth: document.documentElement.scrollWidth,
              }),
              edition,
            );
            await page.screenshot({
              path: fileURLToPath(
                new URL(edition + '/' + name + '-' + width + '.png', root),
              ),
              fullPage: true,
              animations: 'disabled',
              timeout: 10000,
            });
            result.push({ edition, name, width, ...metrics });
          } catch (error) {
            result.push({ edition, name, width, issue: error.name });
          }
          await page.close();
        }
      }),
    );
    await context.close();
  }
} finally {
  await writeFile(
    new URL(
      mode + (wanted.size ? '-' + [...wanted].join('-') : '') + '.json',
      root,
    ),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  server.close();
}
console.log(
  JSON.stringify({
    mode,
    captures: result.length,
    errors: result.filter((x) => x.issue).length,
  }),
);
