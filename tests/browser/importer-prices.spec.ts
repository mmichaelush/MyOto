import { expect, test } from '@playwright/test';
import { resources } from '../../src/data/sources';

test('marks and clears checklist progress and exports matching importer prices', async ({
  page,
}) => {
  await page.route(
    (url) => url.searchParams.get('resource_id') === resources.importers.id,
    async (route) => {
      const url = new URL(route.request().url());
      expect(JSON.parse(url.searchParams.get('filters') ?? '{}')).toEqual({
        shnat_yitzur: 2025,
      });
      const row = {
        shem_yevuan: 'יבואן דוגמה',
        tozeret_nm: 'טויוטה',
        kinuy_mishari: 'COROLLA',
        degem_nm: 'E210',
        mehir: 135000,
      };
      await route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { success: true, result: { total: 2, records: [row, row] } },
      });
    },
  );
  await page.goto('/MyOto/buying-guide/');
  const check = page.getByRole('checkbox').first();
  await check.check();
  await expect(page.getByRole('status')).toContainText('1 מתוך');
  await page.getByRole('button', { name: 'ניקוי הסימונים' }).click();
  await expect(check).not.toBeChecked();
  await page.getByRole('link', { name: 'יבואנים ומחירוני רכב חדש' }).click();
  await page.getByLabel('שנת ייצור').fill('2025');
  await page.getByLabel('יבואן, תוצר או דגם').fill('corolla');
  await page.getByRole('button', { name: 'חיפוש במחירון' }).click();
  const table = page.getByRole('region', { name: 'תוצאות מחירון יבואנים' });
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText('135,000');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'הורדת תוצאות כ־CSV' }).click();
  expect((await download).suggestedFilename()).toBe(
    'myoto-importer-prices-2025.csv',
  );
});
