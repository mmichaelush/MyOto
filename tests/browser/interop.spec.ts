import { expect, firefox, test, webkit } from '@playwright/test';
import { resources } from '../../src/data/sources';

for (const engine of [firefox, webkit]) {
  test(`${engine.name()} looks up an RTL vehicle report and opens the registration archive on mobile`, async ({
    baseURL,
  }) => {
    test.setTimeout(60000);
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({
        baseURL,
        viewport: { width: 320, height: 800 },
      });
      await page.route(
        'https://data.gov.il/api/3/action/datastore_search?**',
        async (route) => {
          const params = new URL(route.request().url()).searchParams;
          const records =
            params.get('resource_id') === resources.private_cars_1.id
              ? [
                  {
                    mispar_rechev: 123456,
                    tozeret_nm: 'יצרן בדיקה',
                    shnat_yitzur: 2022,
                  },
                ]
              : [];
          await route.fulfill({
            headers: { 'access-control-allow-origin': '*' },
            json: { success: true, result: { records } },
          });
        },
      );
      await page.goto('/MyOto/embed/');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await page.getByLabel('מספר רישוי או צמ״ה').fill('0123456');
      await page.getByRole('button', { name: 'חיפוש רכב' }).click();
      await expect(page.locator('.vehicle-report')).toContainText('יצרן בדיקה');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(320);
      await page.goto('/MyOto/registrations/2025/');
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        '2025',
      );
      await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(12);
      await page.goto('/MyOto/electric/');
      await page.locator('summary').filter({ hasText: 'המרכז' }).click();
      await expect(
        page.getByRole('region', { name: 'המרכז', exact: true }),
      ).toContainText('פתח תקווה');
    } finally {
      await browser.close();
    }
  });
}
