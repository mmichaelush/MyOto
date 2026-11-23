import { chromium } from 'playwright';
import resources from '../src/data/resources.json' with { type: 'json' };

const endpoint = 'https://data.gov.il/api/3/action/datastore_search';
const base = process.env.MYOTO_PREVIEW_BASE ?? 'http://127.0.0.1:4322/MyOto/';
const scenarios = [
  ['פרטי', 'private_cars_1', 'mispar_rechev', { sug_degem: 'P' }],
  ['מסחרי', 'private_cars_1', 'mispar_rechev', { sug_degem: 'M' }],
  ['מונית', 'publicTransport', 'mispar_rechev', { sug_rechev_nm: 'מונית' }],
  ['אוטובוס', 'busFleet', 'bus_license_id'],
  ['אופנוע', 'twoWheeled', 'mispar_rechev'],
  ['משאית או התאמה כפולה', 'heavy', 'mispar_rechev'],
  ['צמ״ה', 'cme', 'mispar_tzama'],
  ['יבוא אישי', 'personalImport', 'mispar_rechev'],
  ['רישום מבוטל', 'offRoad_2', 'mispar_rechev'],
  ['רישום מוקפא', 'frozen_with_model', 'mispar_rechev'],
  ['רישום ריקול', 'recall', 'MISPAR_RECHEV'],
  ['היסטוריית בעלות', 'history_2', 'mispar_rechev'],
];

async function sample(source, field, filter) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    resource_id: resources[source].id,
    fields: field,
    filters: JSON.stringify(filter ?? {}),
    limit: '15',
    include_total: 'false',
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const body = await response.json();
  return String(
    body.result?.records.find((row) => /^\d{4,8}$/.test(String(row[field])))?.[
      field
    ] ?? '',
  );
}

async function measure(browser, plate) {
  const page = await browser.newPage({ viewport: { width: 390, height: 850 } });
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().startsWith(endpoint)) requests++;
  });
  try {
    await page.goto(base);
    const timer = performance.now();
    const input = page.locator('#plate');
    await input.fill(plate);
    await input.press('Enter');
    await page
      .locator(
        '.vehicle-heading, #vehicle-recall, .result-chooser, #report > .notice',
      )
      .first()
      .waitFor({ timeout: 20000 });
    const first = Math.round(performance.now() - timer);
    await page.waitForFunction(
      () => !document.querySelector('#report').hasAttribute('aria-busy'),
      {},
      { timeout: 35000 },
    );
    const outcome = (await page.locator('.result-chooser').count())
      ? 'בחירה'
      : (await page.locator('.vehicle-heading').count())
        ? 'דוח רכב'
        : (await page.locator('#vehicle-recall').count())
          ? 'ריקול בלבד'
          : 'ללא דוח';
    return {
      requests,
      firstMs: first,
      fullMs: Math.round(performance.now() - timer),
      outcome,
    };
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [label, source, field, filter] of scenarios) {
    try {
      const plate = await sample(source, field, filter);
      console.log(
        JSON.stringify({
          label,
          ...(plate ? await measure(browser, plate) : { issue: 'No sample' }),
        }),
      );
    } catch (error) {
      console.log(JSON.stringify({ label, issue: error.name }));
      process.exitCode = 1;
    }
  }
} finally {
  await browser.close();
}
