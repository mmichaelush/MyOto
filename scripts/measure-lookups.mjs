import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import resources from '../src/data/resources.json' with { type: 'json' };

const endpoint = 'https://data.gov.il/api/3/action/datastore_search';
const base = process.env.MYOTO_PREVIEW_BASE ?? 'http://127.0.0.1:4322/MyOto/';
const verifyFields = process.argv.includes('--verify-fields');
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
  return [
    ...new Set(
      (body.result?.records ?? [])
        .map((row) => String(row[field] ?? ''))
        .filter((value) => /^\d{4,8}$/.test(value)),
    ),
  ];
}

async function measure(browser, plate) {
  const page = await browser.newPage({ viewport: { width: 390, height: 850 } });
  const responses = [];
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().startsWith(endpoint)) requests++;
  });
  if (verifyFields)
    page.on('response', (response) => {
      if (!response.ok() || !response.url().startsWith(endpoint)) return;
      const source = new URL(response.url()).searchParams.get('resource_id');
      responses.push(
        response.json().then((body) => [source, body.result?.records ?? []]),
      );
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
      ...(verifyFields && (await fieldCheck(page, responses))),
    };
  } finally {
    await page.close();
  }
}

async function fieldCheck(page, responses) {
  const rows = await Promise.all(responses);
  const officialRows = (resourceId) =>
    rows.flatMap(([source, records]) => (resourceId === source ? records : []));
  const verified = [];
  if (await page.locator('.result-chooser').count())
    await page.locator('.result-chooser button').first().click();
  if (await page.locator('.vehicle-heading').count()) {
    await page.locator('.report-more > summary').click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    const result = JSON.parse(
      await readFile(await (await download).path(), 'utf8'),
    );
    for (const field of [
      'tozeret_nm',
      'kinuy_mishari',
      'shnat_yitzur',
      'sug_delek_nm',
      'tokef_dt',
      'mivchan_acharon_dt',
      'kilometer_test_aharon',
      'bitul_nm',
    ]) {
      const observation = result.fields[field]?.chosen;
      if (!observation) continue;
      if (
        !officialRows(observation.resourceId).some((row) =>
          Object.is(row[field], observation.raw),
        )
      )
        throw new Error(`Official source mismatch for ${field}`);
      verified.push(field);
    }
  }
  if (await page.locator('#vehicle-recall').count()) {
    const campaign = officialRows(resources.recall.id)[0];
    const text = await page.locator('#vehicle-recall').innerText();
    if (!campaign?.RECALL_ID || !text.includes(String(campaign.RECALL_ID)))
      throw new Error('Official recall campaign missing in report');
    verified.push('RECALL_ID');
  }
  return { verified };
}

const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [label, source, field, filter] of scenarios) {
    if (
      verifyFields &&
      !['פרטי', 'מסחרי', 'רישום מבוטל', 'רישום ריקול'].includes(label)
    )
      continue;
    try {
      const plates = (await sample(source, field, filter)).slice(
        0,
        process.argv.includes('--two-per-type') ? 2 : 1,
      );
      if (!plates.length)
        console.log(JSON.stringify({ label, issue: 'No sample' }));
      for (const [index, plate] of plates.entries())
        console.log(
          JSON.stringify({
            label,
            sample: index + 1,
            ...(await measure(browser, plate)),
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
