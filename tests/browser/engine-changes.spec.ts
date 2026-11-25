import { expect, test } from '@playwright/test';

test('shows archived retirements and filters observed engine changes', async ({
  page,
}) => {
  await page.route('**/engine-changes/observations.json', (route) =>
    route.fulfill({
      json: [
        {
          fleet: 'פרטי',
          from: '2026-10',
          to: '2026-11',
          comparable: 100,
          changed: 7,
          rows: [
            {
              make: 'טויוטה',
              model: 'COROLLA',
              code: '2ZR',
              comparable: 40,
              changed: 7,
            },
          ],
        },
      ],
    }),
  );
  await page.goto('/MyOto/engine-changes/');
  const table = page.getByRole('region', { name: 'סטטיסטיקות מנועים' });
  await page
    .getByRole('combobox', { name: 'נתונים', exact: true })
    .selectOption('retired');
  await expect(
    table.getByRole('columnheader', { name: 'רישומי ביטול' }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'נתונים', exact: true })
    .selectOption('changes');
  await page.getByLabel('קוד או תוצר מנוע').fill('2ZR');
  await page.getByRole('button', { name: 'הצגה' }).click();
  await expect(table).toContainText('COROLLA');
  await page.getByLabel('קוד או תוצר מנוע').fill('');
  await page.getByRole('combobox', { name: 'תצוגה' }).selectOption('year');
  await page.getByRole('button', { name: 'הצגה' }).click();
  await expect(
    table.getByRole('columnheader', { name: 'שנת זיהוי ומאגר' }),
  ).toBeVisible();
});

test('shows dated live observations and excludes partial windows from annual totals', async ({
  page,
}) => {
  await page.goto('/MyOto/engine-changes/');
  const table = page.getByRole('region', { name: 'סטטיסטיקות מנועים' });
  await page
    .getByRole('combobox', { name: 'נתונים', exact: true })
    .selectOption('changes');
  await page.getByRole('button', { name: 'הצגה' }).click();
  const comparison = table.getByRole('row').filter({ hasText: '246,811' });
  await expect(comparison).toContainText('רכב כבד');
  await expect(comparison).toContainText('24/11/2026 – 25/11/2026');
  await page.getByRole('combobox', { name: 'תצוגה' }).selectOption('year');
  await page.getByRole('button', { name: 'הצגה' }).click();
  await expect(table.getByText('246,811', { exact: true })).toHaveCount(0);
});
