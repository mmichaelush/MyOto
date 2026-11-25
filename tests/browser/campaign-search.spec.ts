import { expect, test } from '@playwright/test';
import { resources } from '../../src/data/sources';

test('opens campaign search from a model year and filters by production range', async ({
  page,
}) => {
  await page.route(
    (url) => url.searchParams.get('resource_id') === resources.campaigns.id,
    (route) => {
      const campaign = {
        RECALL_ID: 101,
        TOZAR_TEUR: 'TOYOTA',
        DEGEM: 'COROLLA',
        SHNAT_RECALL: 2024,
        BUILD_BEGIN_A: '2020-11-02',
        BUILD_END_A: '2021-02-01',
        TEUR_TAKALA: 'תקלה לדוגמה',
        OFEN_TIKUN: 'תיקון לדוגמה',
      };
      const records = [
        campaign,
        campaign,
        { ...campaign, RECALL_ID: 102, BUILD_END_A: '2020-12-31' },
      ];
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { success: true, result: { total: records.length, records } },
      });
    },
  );
  await page.goto('/MyOto/models/toyota/corolla/2021/');
  await page.getByRole('link', { name: 'קריאות שירות לפי דגם' }).click();
  await expect(page.getByLabel('שנת ייצור')).toHaveValue('2021');
  await page.getByRole('button', { name: 'חיפוש קריאות שירות' }).click();
  await expect(page.locator('#campaign-results article')).toHaveCount(1);
  await expect(page.locator('#campaign-results')).toContainText('תיקון לדוגמה');
  await expect(page.locator('#campaign-results')).not.toContainText('102');
  await page.getByLabel('שנת ייצור').fill('2022');
  await page.getByRole('button', { name: 'חיפוש קריאות שירות' }).click();
  await expect(page.getByRole('status')).toContainText(
    'לא נמצאו הודעות מתאימות',
  );
});
