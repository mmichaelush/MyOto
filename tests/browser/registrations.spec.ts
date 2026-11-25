import { expect, test } from '@playwright/test';

test('browses registration years and downloads the published monthly totals', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/MyOto/registrations/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /20\d{2}/,
  );
  const latest = await page
    .locator('a[aria-current=page]')
    .getAttribute('href');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://mmichaelush.github.io' + latest,
  );
  const past = page.getByRole('link', { name: '2025', exact: true });
  await past.click();
  await expect(page).toHaveURL('/MyOto/registrations/2025/');
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(12);
  const csv = await request.get('/MyOto/registrations/2025.csv');
  expect(csv.ok()).toBeTruthy();
  const lines = (await csv.text()).split('\r\n');
  expect(lines[0]).toBe('month,with_model_code,without_model_code,total');
  expect(lines[1]).toMatch(/^202501,\d+,\d+,\d+$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test('shows model registrations on the model overview without attributing them to a production year', async ({
  page,
}) => {
  await page.goto('/MyOto/models/toyota/corolla/');
  await page.getByText('הצגת החודשים הזמינים', { exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'רישומים חודשיים לדגם' }),
  ).toContainText('2026');
  await page.goto('/MyOto/models/toyota/corolla/2021/');
  await expect(page.locator('#model-registrations')).toHaveCount(0);
});

test('opens electric fleet district details and serves the published CSV', async ({
  browser,
  baseURL,
  request,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 800 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/MyOto/electric/');
    await expect(
      page.getByRole('heading', { name: 'כלי רכב חשמליים פעילים' }),
    ).toBeVisible();
    await page.locator('summary').filter({ hasText: 'המרכז' }).click();
    await expect(
      page.getByRole('region', { name: 'המרכז', exact: true }),
    ).toContainText('רחובות');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
    const csv = await request.get('/MyOto/electric/counts.csv');
    expect(csv.ok()).toBeTruthy();
    expect(await csv.text()).toContain('"מחוז","נפה","בעלות","כמות"');
  } finally {
    await context.close();
  }
});
