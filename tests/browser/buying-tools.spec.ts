import { expect, test } from '@playwright/test';

test('compares tire geometry with a prefilled size on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/MyOto/tire-size/?size=205%2F55R16');
  await expect(page.getByLabel('מידה ברישיון או מידה קיימת')).toHaveValue(
    '205/55R16',
  );
  const candidate = page.getByLabel('מידה להשוואה');
  const calculate = page.getByRole('button', { name: 'השוואת מידות' });
  await candidate.fill('225/45R17');
  await calculate.click();
  await expect(page.getByRole('row', { name: /קוטר במ״מ/ })).toContainText(
    '631.9',
  );
  await expect(page.getByRole('status')).toContainText('0.38%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await candidate.fill('185R14C');
  await calculate.click();
  await expect(page.getByRole('status')).toContainText(
    'הזינו שתי מידות רדיאליות',
  );
  await expect(page.getByRole('table')).toBeHidden();
});

test('offers the buyer checklist and official links without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto('/MyOto/buying-guide/');
    const identity = page.getByRole('checkbox', { name: 'זהות הרכב והמוכר' });
    await identity.focus();
    await page.keyboard.press('Space');
    await expect(identity).toBeChecked();
    await expect(
      page.getByRole('link', { name: 'עיון בשעבודים ומשכונות' }),
    ).toHaveAttribute('href', 'https://www.gov.il/he/service/pawn_perusal');
    await expect(
      page.getByRole('link', { name: 'בדיקה במשטרת ישראל' }),
    ).toHaveAttribute(
      'href',
      'https://www.gov.il/he/service/licence_plate_stolen_vehicle_identification',
    );
  } finally {
    await context.close();
  }
});
