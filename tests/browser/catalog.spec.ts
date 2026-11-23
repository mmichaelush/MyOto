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
  const models = page.locator('[data-model-names]');
  const unrelated = models.filter({ hasText: /^OUTLANDER\s/ }).first();
  await expect(unrelated).toBeVisible();
  await page
    .getByRole('searchbox', { name: 'חיפוש בין דגמי היצרן' })
    .fill('לנסר');
  await expect(models.filter({ hasText: /^LANCER\s/ }).first()).toBeVisible();
  await expect(unrelated).toBeHidden();
});
