import { expect, test } from '@playwright/test';

test('serves Hebrew RTL at the Pages base path', async ({ page }) => {
  await page.goto('/MyOto/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByRole('heading', { level: 1, name: /בדיקת.*רכב/ }),
  ).toBeVisible();
});

test('an embedding host with scripts disabled still exposes a standalone link', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(new URL('/MyOto/embed/', baseURL).href);
    const link = page.getByRole('link', { name: 'פתיחת MyOto בחלון נפרד' });
    await expect(link).toHaveAttribute('href', '/MyOto/');
    await expect(link).toHaveAttribute('target', '_blank');
  } finally {
    await context.close();
  }
});
