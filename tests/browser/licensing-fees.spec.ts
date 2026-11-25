import { expect, test } from '@playwright/test';

test('calculates annual fees and clears the amount on vehicle changes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/MyOto/licensing-fees/');
  const kind = page.getByLabel('סוג רכב');
  const calculate = page.getByRole('button', { name: 'חישוב אגרה' });
  const result = page.getByRole('status');
  await page.getByLabel('קבוצת אגרה').selectOption('1');
  await page.getByLabel('שנת עלייה לכביש').fill('2024');
  await calculate.click();
  await expect(result).toContainText('1,401');
  await kind.selectOption('motorcycle');
  await expect(result).toBeEmpty();
  await page.getByLabel('נפח מנוע או הנעה חשמלית').selectOption('3');
  await calculate.click();
  await expect(result).toContainText('52');
  await kind.selectOption('heavy');
  await page.getByLabel('סוג מנוע ומשקל כולל מותר').selectOption('1');
  await calculate.click();
  await expect(result).toContainText('2,877');
  await kind.selectOption('taxi');
  await page.getByLabel('מנוע ומספר מקומות לנוסעים ללא הנהג').selectOption('3');
  await calculate.click();
  await expect(result).toContainText('1,256');
  await kind.selectOption('collector');
  await calculate.click();
  await expect(result).toContainText('265');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test('switches to historical annual and transfer fees', async ({ page }) => {
  await page.goto('/MyOto/licensing-fees/');
  const period = page.getByLabel('תקופת התעריף');
  const year = page.getByLabel('שנת עלייה לכביש');
  const result = page.getByRole('status');
  await page.getByLabel('קבוצת אגרה').selectOption('1');
  await year.fill('2026');
  await period.selectOption('2025');
  await expect(year).toHaveAttribute('max', '2025');
  await expect(
    page.getByRole('heading', { name: 'אגרת העברת בעלות מאפריל 2025' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'אגרת העברת בעלות מאפריל 2026' }),
  ).toHaveCount(0);
  await year.fill('2023');
  await page.getByRole('button', { name: 'חישוב אגרה' }).click();
  await expect(result).toContainText('1,372');
  await period.selectOption('2026');
  await expect(result).toBeEmpty();
  await page.getByRole('button', { name: 'חישוב אגרה' }).click();
  await expect(result).toContainText('1,244');
});
