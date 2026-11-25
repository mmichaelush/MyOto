import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  ['', ''],
  ['models/', ''],
  ['engines/?code=G4LA', '#engine-search'],
  ['engines/g4la/', ''],
  ['fleet/', '#fleet-filters'],
  ['electric/', ''],
  ['registrations/', ''],
  ['buying-guide/', ''],
  ['licensing-fees/', '#fee-form'],
  ['vehicle-cost/', '#vehicle-cost-form'],
  ['tire-size/', '#tire-form'],
] as const;

for (const [path, ready] of pages) {
  test(`WCAG A and AA smoke scan for /MyOto/${path}`, async ({ page }) => {
    await page.goto('/MyOto/' + path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (ready) await expect(page.locator(ready)).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map(({ id, nodes }) => ({
        id,
        elements: nodes.map(({ target }) => target),
      })),
    ).toEqual([]);
  });
}
