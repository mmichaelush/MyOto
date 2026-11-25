import { expect, test } from '@playwright/test';
import { resources } from '../../src/data/sources';

test('reports clipboard, storage, print and PNG failures without losing the report', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      },
    });
    Storage.prototype.setItem = () => {
      throw new DOMException('Denied', 'QuotaExceededError');
    };
    window.print = () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
    HTMLCanvasElement.prototype.toBlob = (callback) => callback(null);
  });
  await page.goto('/MyOto/?search=0123456');
  const status = page.locator('#search-status');
  await page.getByRole('button', { name: 'שיתוף קישור' }).click();
  await expect(status).toHaveText(/ההעתקה לא זמינה/);
  await page.getByRole('button', { name: 'הדפסה / PDF' }).click();
  await expect(status).toHaveText(/לא ניתן לפתוח את חלון ההדפסה/);
  await page.getByText('עוד פעולות', { exact: true }).click();
  await page
    .getByRole('button', { name: 'הוסף למועדפים', exact: true })
    .click();
  await expect(status).toHaveText(/הדפדפן חסם את האחסון המקומי/);
  const image = page.getByRole('button', { name: 'תמונה PNG' });
  await image.click();
  await expect(status).toHaveText(/יצירת התמונה נכשלה/, { timeout: 15000 });
  await expect(image).toBeEnabled();
  await expect(page.locator('.vehicle-report')).toHaveCount(1);
});

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) =>
      url.origin === 'https://data.gov.il' &&
      url.pathname === '/api/3/action/datastore_search',
    async (route) => {
      const params = new URL(route.request().url()).searchParams;
      const filters = JSON.parse(params.get('filters') ?? '{}');
      const resource = params.get('resource_id');
      const record = {
        ...filters,
        shnat_yitzur: 2020,
        tozeret_nm: 'יצרן לדוגמה',
        kinuy_mishari: '<img src=x onerror=alert(1)>',
        baalut: 'פרטי',
      };
      const records =
        resource === resources.private_cars_1.id
          ? [record]
          : resource === resources.history_2.id
            ? [{ ...filters, baalut_dt: 202001, baalut: 'פרטי' }]
            : [];
      await route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { success: true, result: { records } },
      });
    },
  );
});

test('opens a legacy link, renders safe text, saves and exports', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/MyOto/?search=0123456');
  await expect(
    page.getByRole('heading', { name: 'היסטוריית בעלויות' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#report img')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: /<img src=x/ }),
  ).toBeVisible();
  await expect(
    page.locator(
      '.data-section a[href*="gov.il"], .data-metric a[href*="gov.il"]',
    ),
  ).toHaveCount(0);
  await page.getByText('עוד פעולות', { exact: true }).click();
  await page.getByRole('button', { name: 'הוסף למועדפים' }).click();
  await expect(page.getByRole('heading', { name: 'מועדפים' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'הסר ממועדפים' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /הסרת .* מרשימת מועדפים/ }).click();
  await expect(
    page.getByRole('button', { name: 'הוסף למועדפים' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /הסרת .* מרשימת חיפושים אחרונים/ })
    .click();
  const registration = page.getByRole('heading', { name: 'רישוי ובעלות' });
  await expect(registration.locator('..')).toContainText('סוג בעלות ראשונה');
  await expect(registration.locator('..')).toContainText(
    'לא נמצאה קריאת ריקול פתוחה במאגר ההגבלות',
  );
  const footer = page.getByRole('contentinfo');
  await expect(
    footer.getByRole('link', { name: 'מחשבון עלות שנתית' }),
  ).toBeVisible();
  await expect(
    footer.getByRole('link', { name: 'מחשבון מידות צמיגים' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'שיתוף קישור' }).click();
  await expect(page.locator('#search-status')).toHaveText('הקישור הועתק.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '?search=0123456',
  );
  const exportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  expect((await exportEvent).suggestedFilename()).toBe('car-0123456.json');
  const csvEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  expect((await csvEvent).suggestedFilename()).toBe('car-0123456.csv');
});

test('fits a mobile viewport and links into comparison', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto('/MyOto/');
  await page.getByLabel('מספר רישוי או צמ״ה').fill('0123456');
  await page.getByRole('button', { name: 'חיפוש רכב' }).click();
  await expect(
    page.getByRole('heading', { name: 'היסטוריית בעלויות' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await page.getByRole('link', { name: 'השוואה לרכב נוסף' }).click();
  await expect(page.getByLabel('רכב ראשון')).toHaveValue('0123456', {
    timeout: 15000,
  });
  await page.getByLabel('רכב שני').fill('12345678');
  await page.getByRole('button', { name: 'השוואה' }).click();
  await expect(
    page.getByRole('region', { name: 'נתוני השוואה' }).getByRole('table'),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole('heading', { name: 'השוואת מפרט' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ייצוא השוואה ל־CSV' }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toBe('myoto-comparison.csv');
  await page.goBack();
  await expect(page.getByLabel('רכב ראשון')).toHaveValue('0123456', {
    timeout: 15000,
  });
  await expect(page.getByLabel('רכב שני')).toHaveValue('');
});

test('replaces an in-flight lookup and keeps the new result and URL', async ({
  page,
}) => {
  const firstKey = '11111222';
  const secondKey = '33333444';
  await page.route(
    (url) =>
      url.hostname === 'data.gov.il' &&
      url.searchParams.get('resource_id') === resources.private_cars_1.id,
    async (route) => {
      const params = new URL(route.request().url()).searchParams;
      const filter = JSON.parse(params.get('filters') ?? '{}');
      const first = filter.mispar_rechev === Number(firstKey);
      if (first) await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: {
          success: true,
          result: {
            records: [
              { ...filter, tozeret_nm: first ? 'דוח קודם' : 'דוח חדש' },
            ],
          },
        },
      });
    },
  );
  await page.goto('/MyOto/');
  const input = page.getByLabel('מספר רישוי או צמ״ה');
  const sent = page.waitForRequest((request) =>
    request.url().includes(firstKey),
  );
  await input.fill(firstKey);
  await input.press('Enter');
  await sent;
  await input.fill(secondKey);
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: 'דוח חדש' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp('search=' + secondKey));
  await expect(page.getByText('דוח קודם')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'שיתוף קישור' })).toBeVisible();
});

test('prints and downloads the report image', async ({ page }) => {
  await page.goto('/MyOto/?search=0123456');
  await page.getByText('עוד פעולות', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'תמונה PNG' })).toBeVisible();
  const image = page.waitForEvent('download');
  await page.getByRole('button', { name: 'תמונה PNG' }).click();
  expect((await image).suggestedFilename()).toBe('car-0123456.png');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#vehicle-form')).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'היסטוריית בעלויות' }),
  ).toBeVisible();
  const pdf = await page.pdf({ format: 'A4' });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
});

test('runs lookup inside an iframe whose host includes no script', async ({
  page,
}) => {
  await page.route('**/fixture-host/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<iframe title="בדיקת רכב" src="/MyOto/embed/" width="100%" height="720"></iframe>',
    }),
  );
  await page.goto('/fixture-host/');
  const lookup = page.frameLocator('iframe');
  await lookup.getByLabel('מספר רישוי או צמ״ה').fill('0123456');
  await lookup.getByRole('button', { name: 'חיפוש רכב' }).click();
  await expect(
    lookup.getByRole('heading', { name: 'היסטוריית בעלויות' }),
  ).toBeVisible();
});

test('looks up a vehicle inside a 320px sandboxed embed', async ({ page }) => {
  await page.route('**/embed-host/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<iframe sandbox="allow-scripts allow-same-origin allow-forms" width="320" height="800" title="MyOto" src="/MyOto/embed/"></iframe>',
    }),
  );
  await page.goto('/embed-host/');
  const frame = page.frameLocator('iframe');
  await frame.locator('#vehicle-form input').fill('0123456');
  await frame.locator('#vehicle-form button[type="submit"]').click();

  const report = frame.locator('.vehicle-report');
  await expect(report).toContainText('יצרן לדוגמה');
  expect(
    await report.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test('opens an embed query link and shares the standalone report', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/MyOto/?embed=1&search=0123456&debug=1');
  await expect(page).toHaveURL('/MyOto/embed/?search=0123456&debug=1');
  await expect(page.locator('.vehicle-report')).toContainText('יצרן לדוגמה');
  await expect(page.locator('.site-header, .site-footer')).toHaveCount(0);
  await page.getByRole('button', { name: 'שיתוף קישור' }).click();
  await expect
    .poll(async () => {
      const shared = await page.evaluate(() => navigator.clipboard.readText());
      return shared ? new URL(shared).pathname + new URL(shared).search : '';
    })
    .toBe('/MyOto/?search=0123456&type=registration');
});

test('shows the estimated licensing fee in the vehicle report', async ({
  page,
}) => {
  await page.route(
    (url) =>
      url.hostname === 'data.gov.il' &&
      [resources.private_cars_1.id, resources.modelDetails.id].includes(
        url.searchParams.get('resource_id') ?? '',
      ),
    (route) => {
      const params = new URL(route.request().url()).searchParams;
      const filters = JSON.parse(params.get('filters') ?? '{}');
      const row =
        params.get('resource_id') === resources.private_cars_1.id
          ? {
              ...filters,
              sug_degem: 'P',
              tozeret_cd: 10,
              degem_cd: 20,
              shnat_yitzur: 2020,
              moed_aliya_lakvish: '2021-1',
              zmig_kidmi: '205/55R16',
              degem_manoa: 'G4LA',
            }
          : { ...filters, kvuzat_agra_cd: 3 };
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { success: true, result: { records: [row] } },
      });
    },
  );
  await page.goto('/MyOto/?search=0123456');
  await page.getByText('עוד פעולות', { exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'מחשבון מידות צמיגים' }),
  ).toHaveAttribute('href', /\/tire-size\/\?size=205%2F55R16$/);
  await expect(
    page.getByRole('link', { name: 'חיפוש קוד המנוע בקטלוג' }),
  ).toHaveAttribute('href', /\/engines\/\?code=G4LA$/);
  await page.locator('#vehicle-timeline summary').click();
  const timeline = page.getByRole('region', { name: 'אירועים מתועדים' });
  await expect(timeline).toContainText('01/2021');
  await expect(timeline).toContainText('היסטוריית בעלות לפי לוחית');
  const buyer = page.locator('#buyer-checks');
  await buyer.locator('summary').click();
  await expect(buyer).toContainText('1 רישומים במקור');
  await expect(
    buyer.getByRole('link', { name: 'לרשימת הבדיקות המלאה' }),
  ).toHaveAttribute('href', '/MyOto/buying-guide/');
  await expect(page.locator('.report-summary')).toContainText(
    'אגרת רישוי משוערת',
  );
  await expect(page.locator('.report-summary')).toContainText('1,833');
  await page.getByRole('link', { name: 'מחשבון עלות שנתית' }).click();
  await expect(page.locator('[name="a-licensing"]')).toHaveValue('1833');
});

test('exposes source diagnostics and a redacted download only in debug mode', async ({
  page,
}) => {
  await page.goto('/MyOto/?search=0123456&debug=1');
  const diagnostics = page.locator('[data-lookup-diagnostics]');
  await diagnostics.getByText('אבחון חיפוש', { exact: true }).click();
  await expect(diagnostics.locator('li').first()).toBeVisible();
  const file = page.waitForEvent('download');
  await diagnostics.getByRole('button', { name: 'הורדת דוח אבחון' }).click();
  expect((await file).suggestedFilename()).toBe('myoto-diagnostics.json');
  await page.goto('/MyOto/?search=0123456');
  await expect(
    page
      .locator('.vehicle-report')
      .getByRole('heading', { name: 'היסטוריית בעלויות' }),
  ).toBeVisible();
  await expect(diagnostics).toHaveCount(0);
});

test('runs embedded lookups under a strict production content security policy', async ({
  page,
  request,
}) => {
  const embed = await request.get('/MyOto/embed/');
  const markup = await embed.text();
  test.skip(
    !markup.includes('/MyOto/_astro/'),
    'This policy test targets the static production build.',
  );
  await page.route('**/MyOto/embed/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      headers: {
        'content-security-policy': [
          "default-src 'none'",
          "script-src 'self'",
          "style-src 'self'",
          "font-src 'self'",
          "img-src 'self' data:",
          'connect-src https://data.gov.il',
          "form-action 'self'",
          "frame-ancestors 'self'",
        ].join('; '),
      },
      body: markup,
    }),
  );
  await page.route('**/strict-embed-host/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<iframe title="MyOto" sandbox="allow-scripts allow-same-origin allow-forms" width="320" height="800" src="/MyOto/embed/"></iframe>',
    }),
  );
  await page.goto('/strict-embed-host/');
  const frame = page.frameLocator('iframe');
  await frame.getByLabel('מספר רישוי או צמ״ה').fill('0123456');
  await frame.getByRole('button', { name: 'חיפוש רכב' }).click();
  await expect(
    frame.getByRole('heading', { name: 'היסטוריית בעלויות' }),
  ).toBeVisible();
});

test('imports matching local observations and highlights a mileage decrease', async ({
  page,
}) => {
  const chassis = 'JTNFAKE1123456789';
  await page.route(
    (url) =>
      url.searchParams.get('resource_id') === resources.private_cars_1.id,
    (route) =>
      route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: {
          success: true,
          result: {
            records: [
              {
                mispar_rechev: 123456,
                misgeret: chassis,
                moed_aliya_lakvish: '2020-1',
              },
            ],
          },
        },
      }),
  );
  await page.goto('/MyOto/?search=0123456');
  await page.locator('#report-sources > summary').click();
  await page
    .getByText('טעינת היסטוריית רכב מקובץ מקומי', { exact: true })
    .click();
  const upload = page.getByLabel('קובץ תצפיות JSON');
  const payload = {
    schema: 1,
    plate: 123456,
    vehicleKey: await page.evaluate(async (value) => {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(value),
      );
      return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    }, chassis),
    readings: [
      { observedAt: '2026-09-01T00:00:00Z', kilometers: 12000 },
      {
        observedAt: '2026-10-01T00:00:00Z',
        testDate: '2026-09-28',
        kilometers: 11000,
      },
    ],
    engineChanges: [
      {
        from: '2026-09-01T00:00:00Z',
        to: '2026-10-01T00:00:00Z',
        previousModel: 'ABC',
        currentModel: 'DEF',
      },
    ],
  };
  const choose = (vehicleKey: string) =>
    upload.evaluate(
      (input: HTMLInputElement, content) => {
        const files = new DataTransfer();
        files.items.add(
          new File([content], 'observations.json', {
            type: 'application/json',
          }),
        );
        input.files = files.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
      JSON.stringify({ ...payload, vehicleKey }),
    );
  await choose('wrong');
  await expect(
    page.getByText('הקובץ אינו מתאים ללוחית ולשלדה של הרכב בדוח.'),
  ).toBeVisible();
  await choose(payload.vehicleKey);
  const mileage = page.getByRole('region', {
    name: 'היסטוריית קילומטרים מקומית',
  });
  await expect(
    mileage.getByRole('columnheader', { name: 'טסט אחרון במרשם' }),
  ).toBeVisible();
  await expect(mileage.locator('tr.different')).toContainText('28/09/2026');
  await expect(mileage.locator('tr.different')).toContainText('1,000');
  await expect(mileage.locator('tr.different')).toContainText('ירידה');
  await expect(
    page.getByRole('region', { name: 'שינויים במספר מנוע' }),
  ).toContainText('DEF');
  await expect(page.locator('[data-field="vehicle-age"]')).toContainText(
    'גיל הרכב',
  );
});
