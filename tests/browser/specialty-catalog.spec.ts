import { expect, test } from '@playwright/test';

test('opens specialty catalogs and filters an audited source by year', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/MyOto/fleet/');
  await page.getByRole('link', { name: /קטלוגי דו־גלגלי/ }).click();
  await expect(
    page.getByRole('heading', { name: 'קטלוג דו־גלגלי' }),
  ).toBeVisible();
  const yearPicker = page.getByLabel('שנת ייצור');
  const year = await yearPicker.locator('option').nth(1).getAttribute('value');
  await yearPicker.selectOption(year!);
  await expect(page.getByRole('status')).toContainText('נמצאו');
  const table = page.getByRole('region', { name: 'ספירות לפי דגם' });
  for (const text of await table
    .locator('tbody td:nth-child(3)')
    .allTextContents())
    expect(text).toBe(year);
  await page
    .getByRole('link', { name: 'ציוד מכני הנדסי', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'קטלוג ציוד מכני הנדסי' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'מקור', exact: true }),
  ).toHaveAttribute('href', /construction_equipment/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
