import { expect, test } from '@playwright/test';

test('finds a model with a Hebrew alias and opens a year', async ({ page }) => {
  await page.goto('/MyOto/models/');
  await page.getByRole('combobox', { name: 'חיפוש בקטלוג' }).fill('לנסר 2010');
  await expect(page.locator('[data-model]:visible')).toHaveCount(1);
  await page.getByRole('link', { name: /LANCER 2010/ }).click();
  await expect(page).toHaveURL(/models\/mitsubishi\/lancer\/2010\/$/);
  await expect(
    page.getByRole('heading', { name: 'גרסאות וקודי דגם' }),
  ).toBeVisible();
});
