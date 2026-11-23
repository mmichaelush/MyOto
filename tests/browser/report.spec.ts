import { expect, test } from '@playwright/test';
import { resources } from '../../src/data/sources';

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
  ).toBeVisible();
  await expect(page.locator('#report img')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: /<img src=x/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'מועדף' }).click();
  await expect(page.getByRole('heading', { name: 'מועדפים' })).toBeVisible();
  await page.getByRole('button', { name: 'שיתוף קישור' }).click();
  await expect(page.getByRole('status')).toHaveText('הקישור הועתק.');
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
  await page.goBack();
  await expect(page.getByLabel('רכב ראשון')).toHaveValue('0123456');
  await expect(page.getByLabel('רכב שני')).toHaveValue('');
});

test('prints and downloads the report image', async ({ page }) => {
  await page.goto('/MyOto/?search=0123456');
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
