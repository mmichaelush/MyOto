import { expect, test } from 'vitest';
import { expiredDays, ownershipDate } from '../../src/domain/format';
import { previousReading, readingFor } from '../../src/domain/mileage-history';
import { buildReport } from '../../src/domain/report';
import { vehicleViewModel } from '../../src/presentation/vehicle-view-model';
import type { Row } from '../../src/data/types';

const source = (...rows: Row[]) => ({
  rows,
  durationMs: 0,
  fetchedAt: '2026-11-23T10:00:00Z',
});

test('license expiry counts calendar days in Israel using a complete date', () => {
  const now = new Date('2026-11-22T22:15:00Z');
  expect(expiredDays('2026-11-22', now)).toBe(1);
  expect(expiredDays('2026-11-23', now)).toBe(0);
  expect(expiredDays('2026-11', now)).toBe(0);
  expect(expiredDays('2026-11-31', now)).toBe(0);
});

test('ownership dates distinguish the day from the reported period', () => {
  expect(ownershipDate(202205)).toBe('אפריל–יוני 2022');
  expect(ownershipDate('2022-05-17')).toBe('17/05/2022');
  expect(ownershipDate(null)).toBe('מועד לא זמין');
});

test('repeated dealer rows in the same period do not count as distinct owners', () => {
  const registration = source({ tokef_dt: '2026-11-22' });
  const report = buildReport(
    '11234567',
    'registration',
    {
      private_cars_1: registration,
      history_2: source(
        { baalut: 'סוחר', baalut_dt: 202201 },
        { baalut: 'סוחר', baalut_dt: 202202 },
        { baalut: 'סוחר', baalut_dt: 202204 },
        { baalut: 'סוחר', baalut_dt: 202207 },
      ),
    },
    true,
  );
  const view = vehicleViewModel(report, new Date('2026-11-23T00:00:00Z'));
  expect(view.alerts.some((text) => text.includes('3 תקופות שונות'))).toBe(
    true,
  );
  expect(
    view.highlights.find((row) => row.id === 'tokef_dt')?.warning,
  ).toContain('יום אחד');
  expect(
    view.sections
      .flatMap((section) => section.groups.flat())
      .some((row) => row.id === 'tokef_dt'),
  ).toBe(false);
});

test('mileage history compares distinct test days for a verified vehicle', () => {
  const registration = source({
    misgeret: 'JTNFAKE1123456789',
    mispar_manoa: 'ENGINE12345',
    mivchan_acharon_dt: '2026-06-04',
  });
  const history = source({
    mispar_manoa: 'ENGINE12345',
    kilometer_test_aharon: 80000,
  });
  const report = buildReport(
    '11234567',
    'registration',
    { private_cars_1: registration, history_1: history },
    true,
  );
  const current = readingFor(report)?.reading;
  expect(current).toEqual({ date: '2026-06-04', km: 80000 });
  expect(
    previousReading(
      [
        { date: '2026-06-04', km: 88000 },
        { date: '2025-01-01', km: 90000 },
        { date: '2026-03-12', km: 94000 },
      ],
      current!,
    ),
  ).toEqual({ date: '2026-03-12', km: 94000 });
  expect(readingFor({ ...report, unverified: ['history_1'] })).toBeUndefined();
});
