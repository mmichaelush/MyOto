import { expect, test } from '@playwright/test';

test('filters published fleet data, restores the URL, and exports CSV', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/MyOto/fleet/?make=toyota&year=2021&group=make');
  const table = page.getByRole('table');
  await expect(table.getByRole('link', { name: 'טויוטה' })).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.getByRole('link', { name: 'טויוטה' })).toHaveAttribute(
    'href',
    '/MyOto/models/?make=toyota&year=2021',
  );
  await page.getByLabel('סוג דגם').selectOption('P');
  await page.getByRole('button', { name: 'הצגת נתונים' }).click();
  await expect(page).toHaveURL(/type=P/);
  const file = page.waitForEvent('download');
  await page.getByRole('link', { name: 'הורדת הטבלה כ־CSV' }).click();
  expect((await file).suggestedFilename()).toBe('myoto-fleet.csv');
  await page.goBack();
  await expect(page.getByLabel('סוג דגם')).toHaveValue('');
  await expect(table.getByRole('link', { name: 'טויוטה' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test('serves national counts as static HTML when scripts are disabled', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto('/MyOto/fleet/');
    await expect(
      page.getByRole('link', { name: '2021', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'הצגת נתונים' }),
    ).toBeHidden();
  } finally {
    await context.close();
  }
});
