import { expect, test } from '@playwright/test';

test('serves Hebrew RTL at the Pages base path', async ({ page }) => {
  await page.goto('/MyOto/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByRole('heading', { level: 1, name: /בדיקת.*רכב/ }),
  ).toBeVisible();
});
