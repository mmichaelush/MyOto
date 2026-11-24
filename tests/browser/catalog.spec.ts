import { expect, test } from '@playwright/test';

test('finds a model with a Hebrew alias and opens a year', async ({ page }) => {
  await page.goto('/MyOto/models/');
  await page.getByRole('combobox', { name: 'חיפוש בקטלוג' }).fill('לנסר 2010');
  await expect(page.locator('[data-model]:visible')).toHaveCount(1, {
    timeout: 15_000,
  });
  await page.getByRole('link', { name: /LANCER 2010/ }).click();
  await expect(page).toHaveURL(/models\/mitsubishi\/lancer\/2010\/$/);
  await expect(
    page.getByRole('heading', { name: 'גרסאות וקודי דגם' }),
  ).toBeVisible();
});

test('filters a manufacturer by model name and a Hebrew alias', async ({
  page,
}) => {
  await page.goto('/MyOto/models/mitsubishi/');
  const photo = page.getByRole('img', { name: 'מיצובישי לנסר' });
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(330);
  await expect(
    page.getByRole('link', { name: 'CC BY-SA 3.0' }),
  ).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/3.0/');
  const models = page.locator('[data-model-names]');
  const unrelated = models.filter({ hasText: /^OUTLANDER\s/ }).first();
  await expect(unrelated).toBeVisible();
  await page
    .getByRole('searchbox', { name: 'חיפוש בין דגמי היצרן' })
    .fill('לנסר');
  await expect(models.filter({ hasText: /^LANCER\s/ }).first()).toBeVisible();
  await expect(unrelated).toBeHidden();
});

test('downloads facet data only for facet filters and opens a matching year', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/models/facets.json', async (route) => {
    requests++;
    await route.fulfill({
      json: {
        'toyota/corolla': { ownershipByTrim: [['style', 'פרטי', [2021]]] },
      },
    });
  });
  await page.goto('/MyOto/models/');
  await page.getByRole('combobox', { name: 'חיפוש בקטלוג' }).fill('קורולה');
  await expect(
    page.getByRole('link', { name: /^COROLLA טויוטה$/ }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await page.getByText('סינון לפי גימור ובעלות', { exact: true }).click();
  await page.getByRole('textbox', { name: 'רמת גימור' }).fill('style');
  await page.getByLabel('בעלות במדגם').selectOption('פרטי');
  await expect(
    page.getByRole('link', { name: /COROLLA 2021/ }),
  ).toHaveAttribute('href', /toyota\/corolla\/2021\/$/);
  expect(requests).toBe(1);
});

test('model overview shows fleet statistics and samples ownership for the selected year', async ({
  page,
}) => {
  await page.goto('/MyOto/models/mitsubishi/lancer/');
  await expect(
    page.getByRole('heading', { name: 'התפלגות כלי הרכב הפעילים' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'סוגי בעלות רשומה' }),
  ).toBeVisible();
  const select = page.getByLabel('שנתון למדגם');
  await select.selectOption('2010');
  const [type, make, code, year] = JSON.parse(
    (await select.locator('option[value="2010"]').getAttribute('data-codes'))!,
  )[0].split('/');
  await page.route(
    'https://data.gov.il/api/3/action/datastore_search?**',
    async (route) => {
      const params = new URL(route.request().url()).searchParams;
      expect(JSON.parse(params.get('filters')!)).toMatchObject({
        kinuy_mishari: 'LANCER',
        shnat_yitzur: 2010,
      });
      const records =
        params.get('limit') === '0'
          ? []
          : Array.from({ length: 40 }, (_, i) => ({
              mispar_rechev: 10000000 + i,
              sug_degem: type,
              tozeret_cd: Number(make),
              degem_cd: Number(code),
              shnat_yitzur: Number(year),
              baalut: i < 30 ? 'פרטי' : 'השכרה',
            }));
      await route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { success: true, result: { total: 40, records } },
      });
    },
  );
  await page.getByRole('button', { name: 'בדיקת מדגם עדכני' }).click();
  await expect(page.getByRole('status')).toHaveText(/מדגם של 40/);
  await expect(page.getByText(/פרטי.*75%/)).toBeVisible();
  await expect(page.getByText(/השכרה.*25%/)).toBeVisible();
});
