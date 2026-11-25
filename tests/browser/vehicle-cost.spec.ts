import { expect, test } from '@playwright/test';

test('compares entered fuel and electric running costs on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/MyOto/vehicle-cost/');
  await page.getByLabel('נסועה שנתית בק״מ').fill('10000');
  const a = page.getByRole('group', { name: 'רכב א׳' });
  const b = page.getByRole('group', { name: 'רכב ב׳' });
  await a.getByLabel('צריכת דלק בליטרים ל־100 ק״מ').fill('7');
  await a.getByLabel('מחיר לליטר בש״ח').fill('7');
  await a.getByLabel('ביטוח שנתי בש״ח').fill('3000');
  await b.getByLabel('יחידת צריכה').selectOption('electric');
  await b.getByLabel('צריכת חשמל בקוט״ש ל־100 ק״מ').fill('18');
  await b.getByLabel('מחיר לקוט״ש בש״ח').fill('0.5');
  await b.getByLabel('ביטוח שנתי בש״ח').fill('4000');
  await page.getByRole('button', { name: 'חישוב והשוואה' }).click();
  const table = page.getByRole('table');
  await expect(table.getByRole('row', { name: /סה״כ לשנה/ })).toContainText(
    '7,900',
  );
  await expect(table.getByRole('row', { name: /סה״כ לשנה/ })).toContainText(
    '4,900',
  );
  await expect(page.getByRole('status')).toContainText('3,000');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.getByLabel('נסועה שנתית בק״מ').fill('0');
  await expect(table).toBeHidden();
  await page.getByRole('button', { name: 'חישוב והשוואה' }).click();
  await expect(
    table.getByRole('row', { name: /עלות לק״מ/ }).getByRole('cell'),
  ).toHaveText(['—', '—']);
});
test('includes purchase and resale in ownership cost with an electric prefill', async ({
  page,
}) => {
  await page.goto('/MyOto/vehicle-cost/?unit=electric');
  await expect(page.locator('[name=a-unit]')).toHaveValue('electric');
  await page.locator('[name=distance]').fill('10000');
  await page.locator('[name=a-consumption]').fill('18');
  await page.locator('[name=a-unitPrice]').fill('1');
  await page.locator('[name=b-consumption]').fill('7');
  await page.locator('[name=b-unitPrice]').fill('7');
  await page
    .getByText('השוואה כולל מחיר רכישה ושווי מכירה', { exact: true })
    .click();
  await page.locator('[name=years]').fill('3');
  await page.locator('[name=a-purchase]').fill('120000');
  await page.locator('[name=a-resale]').fill('80000');
  await page.locator('[name=b-purchase]').fill('100000');
  await page.getByRole('button', { name: 'חישוב והשוואה' }).click();
  await expect(page.getByRole('status')).toContainText('מלאו את התקופה');
  await page.locator('[name=b-resale]').fill('70000');
  await page.getByRole('button', { name: 'חישוב והשוואה' }).click();
  const total = page.getByRole('row', { name: /עלות החזקה כוללת ל־3 שנים/ });
  await expect(total).toContainText('45,400');
  await expect(total).toContainText('44,700');
  await expect(page.getByRole('status')).toContainText('700');
});
