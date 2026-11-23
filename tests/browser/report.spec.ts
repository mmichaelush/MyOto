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
  await page.getByRole('button', { name: 'מועדף', exact: true }).click();
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
  await page.getByRole('button', { name: 'מועדף' }).click();
  await expect(page.getByRole('heading', { name: 'מועדפים' })).toBeVisible();
  await page.getByRole('button', { name: 'שיתוף קישור' }).click();
  await expect(page.locator('#search-status')).toHaveText('הקישור הועתק.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '?search=0123456',
  );
  const exportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  expect((await exportEvent).suggestedFilename()).toBe('car-0123456.json');
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
  await expect(page.getByLabel('רכב ראשון')).toHaveValue('0123456');
  await page.getByLabel('רכב שני').fill('12345678');
  await page.getByRole('button', { name: 'השוואה' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'השוואת מפרט' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await page.goBack();
  await expect(page.getByLabel('רכב ראשון')).toHaveValue('0123456');
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
