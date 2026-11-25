import { expect, test } from '@playwright/test';

test('finds a recorded tire size and links to its models and calculator', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/MyOto/tires/?size=205%2F55R16');
  const results = page.getByRole('region', {
    name: 'דגמים עם מידת הצמיג שנבחרה',
  });
  await expect(results.locator('tbody tr').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(results.locator('tbody a').first()).toHaveAttribute(
    'href',
    /\/MyOto\/models\/.+\/\d{4}\/$/,
  );
  await page.getByLabel('סרן').selectOption('rear');
  await page.getByRole('button', { name: 'איתור דגמים' }).click();
  const rear = await results
    .locator('tbody tr td:last-child')
    .allTextContents();
  expect(rear.length).toBeGreaterThan(0);
  expect(rear.every((count) => count !== '0')).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'הורדת תוצאות כ־CSV' }).click();
  expect((await download).suggestedFilename()).toBe(
    'myoto-tires-205-55R16.csv',
  );
  await page.getByRole('link', { name: 'מחשבון מידות צמיגים' }).click();
  await expect(page.getByLabel('מידה ברישיון או מידה קיימת')).toHaveValue(
    '205/55R16',
  );
});
