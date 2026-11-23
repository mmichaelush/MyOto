import { expect, test, type Page } from '@playwright/test';
import { resources } from '../../src/data/sources';

const registration = '11234567';
const bike = '21234567';
const collision = '91234567';
const missing = '81234567';
const partial = '71234567';
const onlyRecall = '61234567';
const dataHost = 'https://data.gov.il';

async function fixtures(page: Page, requested: string[] = []) {
  await page.clock.setFixedTime(new Date('2026-11-23T10:00:00Z'));
  await page.route(
    (url) =>
      url.origin === dataHost && url.pathname.endsWith('/datastore_search'),
    async (route) => {
      const search = new URL(route.request().url()).searchParams;
      const query = JSON.parse(search.get('filters') ?? '{}');
      const source = search.get('resource_id');
      if (source) requested.push(source);
      const plate = String(
        query.mispar_rechev ?? query.mispar_tzama ?? query.MISPAR_RECHEV ?? '',
      );
      if (plate === partial && source === resources.private_cars_1.id) {
        await route.fulfill({
          status: 404,
          headers: { 'access-control-allow-origin': '*' },
        });
        return;
      }
      if (plate === partial && source === resources.recall.id) {
        await route.fulfill({
          status: 404,
          headers: { 'access-control-allow-origin': '*' },
        });
        return;
      }
      const records = [];
      if (
        [registration, collision].includes(plate) &&
        source === resources.private_cars_1.id
      ) {
        records.push({
          mispar_rechev: Number(plate),
          shnat_yitzur: 2021,
          tozeret_nm: 'טויוטה',
          kinuy_mishari: 'COROLLA',
          degem_nm: 'E210',
          baalut: 'פרטי',
          misgeret: 'JTNFAKE1123456789',
          shilda: 'JTNFAKE1123456789',
          mispar_manoa: 'ME1234567',
          sug_delek_nm: 'בנזין',
          tzeva_rechev: 'לבן',
          nefach_manoa: 1798,
          koah_sus: 122,
          automatic_ind: 1,
          ramat_gimur: 'STYLE',
          tokef_dt: '2027-04-07',
          mivchan_acharon_dt: '2026-04-07',
          mispar_kariot_avir: 7,
          abs_ind: 1,
          mishkal_kolel: 1845,
          zmig_kidmi: '205/55R16',
          zmig_ahori: '205/55R16',
          kvutzat_zihum: 3,
        });
      }
      if (plate === bike && source === resources.twoWheeled.id) {
        records.push({
          mispar_rechev: Number(plate),
          shnat_yitzur: 2022,
          tozeret_nm: 'הונדה',
          kinuy_mishari: 'CB500X',
          sug_rechev_nm: 'אופנוע',
          nefach_manoa: 471,
          koah_sus: 47,
          tokef_dt: '2027-06-17',
        });
      }
      if (plate === collision && source === resources.cme.id) {
        records.push({
          mispar_tzama: Number(plate),
          sug_tzama_nm: 'מחפר זחלי',
          shilda_totzar_en_nm: 'CATERPILLAR',
          tokef_date: '2027-05-01',
        });
      }
      if (plate === registration && source === resources.history_1.id) {
        records.push({
          mispar_rechev: Number(plate),
          mispar_manoa: 'ME1234567',
          kilometer_test_aharon: 86541,
        });
      }
      if (plate === registration && source === resources.history_2.id) {
        records.push(
          ...Array.from({ length: 8 }, (_row, index) => ({
            _id: index + 1,
            mispar_rechev: Number(plate),
            baalut_dt: 202101 + index,
            baalut: index === 1 ? 'ליסינג' : 'פרטי',
          })),
        );
      }
      if (
        [registration, onlyRecall].includes(plate) &&
        source === resources.recall.id
      ) {
        records.push({
          MISPAR_RECHEV: Number(plate),
          RECALL_ID: 501,
          TAARICH_PTICHA: '2026-10-03',
          SUG_TAKALA: 'מערכת בלימה',
          TEUR_TAKALA: 'יש לתאם בדיקה עם היבואן.',
        });
      }
      if (source === resources.campaigns.id && query.RECALL_ID?.includes(501)) {
        records.push({
          RECALL_ID: 501,
          OFEN_TIKUN: 'החלפת רכיב במערכת הבלימה',
          YEVUAN_TEUR: 'שם היבואן',
          TELEPHONE: '03-555-5555',
          WEBSITE: 'javascript:alert(1)',
        });
      }
      await route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { success: true, result: { records } },
      });
    },
  );
}

for (const width of [390, 1366]) {
  test(`home and report at ${width}px`, async ({ page }) => {
    await fixtures(page);
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/MyOto/');
    await expect(page.locator('#vehicle-form input')).toHaveCount(1);
    await expect(page.locator('#vehicle-form select')).toHaveCount(0);
    await expect(page).toHaveScreenshot(`home-${width}.png`);
    await page.getByLabel('מספר רישוי או צמ״ה').fill('112-34-567');
    await page.getByLabel('מספר רישוי או צמ״ה').press('Enter');
    await expect(
      page.getByRole('heading', { name: 'היסטוריית בעלויות' }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator(
        '.data-section a[href*="gov.il"], .data-metric a[href*="gov.il"]',
      ),
    ).toHaveCount(0);
    await expect(
      page.locator('.data-row').filter({ hasText: 'מספר שלדה' }),
    ).toHaveCount(1);
    await expect(page).toHaveScreenshot(`report-${width}.png`, {
      fullPage: true,
    });
    await page.getByRole('link', { name: 'ריקולים', exact: true }).click();
    await expect(page).toHaveURL(/#vehicle-recall$/);
    await expect(page.getByText('החלפת רכיב במערכת הבלימה')).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole('heading', { name: 'היסטוריית בעלויות' }),
    ).toBeVisible();
  });
}

test('collision, incomplete and empty lookups remain distinguishable', async ({
  page,
}) => {
  await fixtures(page);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto(`/MyOto/?search=${collision}`);
  await expect(
    page.getByRole('heading', { name: 'נמצאו שני כלים עם אותו מספר' }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('collision-390.png');
  await page.getByRole('button', { name: /צמ״ה/ }).click();
  await expect(page).toHaveURL(/type=equipment/);
  await expect(
    page.getByRole('heading', { name: 'CATERPILLAR' }),
  ).toBeFocused();
  await expect(page.getByText('טויוטה')).toHaveCount(0);
  await page.goto(`/MyOto/?search=${partial}`);
  await expect(page.getByRole('heading', { name: 'הבדיקה חלקית' })).toBeVisible(
    { timeout: 15000 },
  );
  await expect(page.getByText(/צמ״ה: נבדק ולא נמצאה התאמה/)).toBeVisible();
  await expect(page).toHaveScreenshot('partial-390.png');
  await page.goto(`/MyOto/?search=${missing}`);
  await expect(
    page.getByRole('heading', { name: 'לא נמצאה התאמה' }),
  ).toBeVisible({ timeout: 15000 });
});

test('the main search includes recall even without a matching registry identity', async ({
  page,
}) => {
  const requested: string[] = [];
  await fixtures(page, requested);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/MyOto/');
  const input = page.getByLabel('מספר רישוי או צמ״ה');
  await input.fill(onlyRecall);
  await input.press('Enter');
  await expect(
    page.getByText('נמצאה קריאת שירות במאגר ההגבלות.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'אתר היבואן' })).toHaveCount(0);
  await expect(page.getByText('החלפת רכיב במערכת הבלימה')).toBeVisible();
  expect(new Set(requested).size).toBe(21);
  expect(requested.filter((id) => id === resources.recall.id)).toHaveLength(1);
  expect(requested).toContain(resources.campaigns.id);
  await expect(
    page.getByText('לא נמצאה רשומת רישוי במספר שהוזן.'),
  ).toBeVisible();
  for (const width of [1440, 1366, 1024, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await page.setViewportSize({ width: 390, height: 850 });
  await expect(page).toHaveScreenshot('recall-390.png');
  await input.fill(missing);
  await input.press('Enter');
  await expect(
    page.getByText('לא נמצאה התאמה במאגר ההגבלות על ריקול.'),
  ).toBeVisible();
  await input.fill(partial);
  await input.press('Enter');
  await expect(page.locator('#vehicle-recall')).toHaveClass(
    /recall-unavailable/,
  );
});

test('catalog and comparison render on a narrow tablet and print stays readable', async ({
  page,
}) => {
  await fixtures(page);
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/MyOto/models/mitsubishi/lancer/2010/');
  await expect(
    page.getByRole('heading', { name: 'גרסאות וקודי דגם' }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('catalog-year-768.png');
  await page.goto(`/MyOto/compare/?a=${registration}&b=${bike}`);
  await expect(page.getByRole('heading', { name: 'השוואת מפרט' })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'הבדלים בלבד' }).click();
  await expect(page.locator('tr.different:visible').first()).toBeVisible();
  await expect(page).toHaveScreenshot('comparison-768.png');
  await page.goto(`/MyOto/?search=${registration}`);
  await expect(
    page.getByRole('heading', { name: 'היסטוריית בעלויות' }),
  ).toBeVisible({ timeout: 15000 });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#vehicle-form')).toBeHidden();
  await expect(page).toHaveScreenshot('print-768.png', {
    maxDiffPixelRatio: 0.04,
  });
  const pdf = await page.pdf({ format: 'A4' });
  expect(
    pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0,
  ).toBeGreaterThan(1);
});

test('catalog controls fit all audited widths', async ({ page }) => {
  await page.goto('/MyOto/models/');
  for (const width of [1440, 1366, 1024, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await page.setViewportSize({ width: 390, height: 850 });
  await expect(page).toHaveScreenshot('catalog-home-390.png');
});
