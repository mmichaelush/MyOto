import { expect, test } from 'vitest';
import { buildReport } from '../../src/domain/report';
import { lookupDiagnostics } from '../../src/ui/diagnostics';

test('exports only allowlisted metadata, omitting values and registry identifiers', () => {
  const plate = '04321987';
  const report = buildReport(
    plate,
    'registration',
    {
      private_cars_1: {
        rows: [
          {
            mispar_rechev: Number(plate),
            misgeret: 'TEST-VIN-NOT-FOR-EXPORT',
            tokef_dt: '2027-05-01',
            unsafe_data_key: 'SECRET-VALUE',
          },
        ],
        fetchedAt: '2026-11-24T08:00:00Z',
        durationMs: 174,
        cached: true,
      },
    },
    true,
  );
  const result = lookupDiagnostics('search', [report]);
  const json = JSON.stringify(result);
  expect(json).not.toContain(plate);
  expect(json).not.toContain('TEST-VIN');
  expect(json).not.toContain('unsafe_data_key');
  expect(json).not.toContain('2027-05-01');
  expect(result.reports[0].fields).toContainEqual(
    expect.objectContaining({ field: 'tokef_dt', source: 'private_cars_1' }),
  );
  expect(result.reports[0].sources).toContainEqual(
    expect.objectContaining({
      id: 'private_cars_1',
      cached: true,
      records: 1,
      durationMs: 0,
    }),
  );
});
