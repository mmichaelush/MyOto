import { expect, test } from 'vitest';
import { buildReport } from '../../src/domain/report';
import {
  fieldSchema,
  vehicleViewModel,
} from '../../src/presentation/vehicle-view-model';
import { fieldLabels } from '../../src/domain/format';
import type { Row } from '../../src/data/types';

const reply = (...rows: Row[]) => ({
  rows,
  fetchedAt: '2026-11-23T10:00:00Z',
  durationMs: 12,
});

test('maps every legacy field to a canonical presentation rule', () => {
  const represented = new Set(fieldSchema.flatMap((rule) => rule.keys));
  expect(
    Object.keys(fieldLabels).filter((key) => !represented.has(key)),
  ).toEqual([]);
});

test('deduplicates equivalent chassis fields without deleting source values', () => {
  const report = buildReport(
    '11234567',
    'registration',
    {
      private_cars_1: reply({
        misgeret: 'ABC-1234',
        mispar_shilda: 'abc1234',
        shilda: 'ABC4567',
        delek_nm: 'בנזין',
        sug_delek_nm: 'בנזין',
        hanaa_nm: 'קדמית',
      }),
    },
    true,
  );
  const view = vehicleViewModel(report);
  const rows = view.sections.flatMap((section) => section.groups.flat());
  const chassis = rows.filter((row) => row.id === 'misgeret');
  expect(chassis).toHaveLength(1);
  expect(chassis[0].differences?.map((row) => row.text)).toEqual([
    'ABC-1234',
    'ABC4567',
  ]);
  expect(report.sources.private_cars_1?.rows[0].shilda).toBe('ABC4567');
  expect(rows.some((row) => row.id === 'sug_delek_nm')).toBe(true);
  expect(rows.some((row) => row.id === 'hanaa_nm')).toBe(true);
});

test('only highlights available data and puts equipment-specific information first', () => {
  const report = buildReport(
    '51234567',
    'equipment',
    {
      cme: reply({
        sug_tzama_nm: 'מחפר',
        shilda_totzar_en_nm: 'CATERPILLAR',
        tokef_date: '2027-05-01',
        kosher_harama_ton: 4,
        mishkal_ton: 22,
      }),
    },
    true,
  );
  const view = vehicleViewModel(report);
  expect(view.title).toContain('CATERPILLAR');
  expect(view.status).toBeUndefined();
  expect(view.highlights.map((row) => row.text)).toEqual(['01/05/2027']);
  expect(view.sections[0].title).toBe('נתוני צמ״ה');
  expect(
    view.sections[0].groups.flat().find((row) => row.id === 'kosher_harama_ton')
      ?.text,
  ).toBe('4 טון');
});
