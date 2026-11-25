import { expect, test } from '@playwright/test';

test('compares catalog years from a shared URL and exports CSV', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(
    '/MyOto/compare-models/?a=toyota%2Fcorolla%2F2021&b=mitsubishi%2Flancer%2F2010',
  );
  const table = page.getByRole('region', { name: 'טבלת השוואת דגמים' });
  await expect(table).toContainText(/COROLLA.*2021/i);
  await expect(table).toContainText(/LANCER.*2010/i);
  await expect(table).toContainText('קודי מנוע שנצפו');
  await expect(table).toContainText('חציון נסועה במדגם');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'הורדת השוואה כ־CSV' }).click();
  expect((await download).suggestedFilename()).toBe(
    'myoto-model-comparison.csv',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
test('compares engine codes with counts scoped to the selected engines', async ({
  page,
}) => {
  await page.goto(
    '/MyOto/compare-models/?a=toyota%2Fcorolla%2F2021&b=mitsubishi%2Flancer%2F2010&engine-a=2ZR&engine-b=4A91',
  );
  const table = page.getByRole('region', { name: 'טבלת השוואת דגמים' });
  await expect(
    table.getByRole('columnheader', { name: /COROLLA.*2ZR/i }),
  ).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: /LANCER.*4A91/i }),
  ).toBeVisible();
  const observations = table.getByRole('row', {
    name: /תצפיות לקוד מנוע במרשם הפעיל/,
  });
  await expect(observations).toContainText('1,017');
  await expect(observations).toContainText('1,950');
  const mileage = table.getByText('חציון נסועה במדגם השנתון', { exact: true });
  await expect(mileage.locator('..')).toHaveText(/—.*—/);
  await page.getByLabel('הצגת הבדלים בלבד').check();
  await expect(mileage).toBeHidden();
  await expect(observations).toBeVisible();
});
