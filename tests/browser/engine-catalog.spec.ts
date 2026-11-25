import { expect, test } from '@playwright/test';

test('finds a registry engine code and follows its link to a catalog year', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/MyOto/engines/?code=G4LA');
  const code = page.getByRole('link', { name: /^G4LA / });
  await expect(code).toBeVisible();
  await code.click();
  await expect(
    page.getByRole('heading', { name: 'קוד מנוע G4LA', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'דגמים המקושרים לקוד' }),
  ).toBeVisible();
  const year = page.locator('a[href="/MyOto/models/kia/picanto/2017/"]');
  await year.click();
  await expect(
    page.getByRole('heading', { name: 'קודי מנוע שנצפו' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'G4LA', exact: true }),
  ).toHaveAttribute('href', '/MyOto/engines/g4la/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
