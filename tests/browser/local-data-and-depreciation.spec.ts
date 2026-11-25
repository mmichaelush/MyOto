import { expect, test } from '@playwright/test';

test('clears only MyOto storage and leaves other applications alone', async ({
  page,
}) => {
  const keys = [
    'myoto-recent',
    'myoto-favorites',
    'myoto-report-order-v2',
    'myoto-report-order',
    'myoto-test-mileage',
  ];
  await page.goto('/MyOto/privacy/');
  await page.evaluate((keys) => {
    for (const key of keys) localStorage.setItem(key, 'example');
    localStorage.setItem('unrelated-app', 'keep');
  }, keys);
  await page.getByRole('link', { name: 'ניהול ומחיקת נתונים מקומיים' }).click();
  await page.getByText('מחיקת הנתונים המקומיים', { exact: true }).click();
  await page.getByRole('button', { name: 'מחיקת נתוני MyOto' }).click();
  await expect(page.getByRole('status')).toContainText('נמחקו');
  expect(
    await page.evaluate(
      (keys) => [
        ...keys.map((key) => localStorage.getItem(key)),
        localStorage.getItem('unrelated-app'),
      ],
      keys,
    ),
  ).toEqual([null, null, null, null, null, 'keep']);
});

test('shows compounded depreciation and clears stale results on edit', async ({
  page,
}) => {
  await page.goto('/MyOto/vehicle-cost/');
  await page.getByRole('link', { name: 'מחשבון ירידת ערך משוערת' }).click();
  await page.locator('[name=price]').fill('100000');
  await page.locator('[name=rate]').fill('10');
  await page.locator('[name=years]').fill('2');
  await page.getByRole('button', { name: 'חישוב ירידת ערך' }).click();
  const rows = page
    .getByRole('region', { name: 'שווי לפי שנה' })
    .locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText('81,000');
  await expect(rows.nth(1)).toContainText('19,000');
  await page.locator('[name=rate]').fill('0');
  await expect(page.locator('#depreciation-results')).toBeHidden();
  await page.getByRole('button', { name: 'חישוב ירידת ערך' }).click();
  await expect(rows.nth(1)).toContainText('100,000');
});
