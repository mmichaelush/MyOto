import { expect, test } from '@playwright/test';

test('fills the inspection category and displays first and repeat test rates separately', async ({
  page,
}) => {
  await page.goto('/MyOto/inspection-fees/?kind=light&electric=1');
  const status = page.getByRole('status');
  const calculate = page.getByRole('button', { name: 'הצגת מחיר' });
  await expect(page.getByLabel('סוג רכב')).toHaveValue('light');
  await calculate.click();
  await expect(status).toContainText('106.32');
  await page.getByLabel('סוג מבחן').selectOption('1');
  await expect(status).toBeEmpty();
  await calculate.click();
  await expect(status).toContainText('26.83');
  await page.getByLabel('סוג רכב').selectOption('motorcycle');
  await calculate.click();
  await expect(status).toContainText('לא פורסם תעריף');
});
