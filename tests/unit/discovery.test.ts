import { expect, test, vi } from 'vitest';
import { CkanClient } from '../../src/data/ckan';
import {
  VehicleEngine,
  registrationRequestBudget,
} from '../../src/data/engine';
import { resources } from '../../src/data/sources';
import type { Row } from '../../src/data/types';

const signal = () => new AbortController().signal;
const reply = (records: Row[]) =>
  Response.json({ success: true, result: { records } });

test.each([
  [true, false, 'found', 'empty'],
  [false, true, 'empty', 'found'],
  [true, true, 'found', 'found'],
  [false, false, 'empty', 'empty'],
] as const)(
  'keeps search namespaces separate (registration %s, equipment %s)',
  async (registration, equipment, regularCheck, equipmentCheck) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const params = new URL(String(input)).searchParams;
      const source = params.get('resource_id');
      if (source === resources.private_cars_1.id && registration)
        return reply([{ mispar_rechev: 123456, tozeret_nm: 'רכב א׳' }]);
      if (source === resources.cme.id && equipment)
        return reply([{ mispar_tzama: 123456, sug_tzama_nm: 'מחפר' }]);
      return reply([]);
    });
    const result = await new VehicleEngine(new CkanClient(fetcher)).discover(
      '00123456',
      signal(),
    );
    expect(result.checks).toEqual({
      registration: regularCheck,
      equipment: equipmentCheck,
    });
    const [car, machine] = result.reports;
    expect(car.plate).toBe('00123456');
    expect(machine.plate).toBe('00123456');
    expect(car.fields.sug_tzama_nm).toBeUndefined();
    expect(machine.fields.tozeret_nm).toBeUndefined();
    expect(car.sources.cme).toBeUndefined();
    expect(machine.sources.private_cars_1).toBeUndefined();
    expect(
      fetcher.mock.calls.filter(([url]) =>
        String(url).includes(resources.cme.id),
      ),
    ).toHaveLength(1);
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(
      registrationRequestBudget,
    );
  },
);

test('keeps a failed namespace visible alongside the result from the other one', async () => {
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const source = new URL(String(input)).searchParams.get('resource_id');
    if (source === resources.cme.id)
      return new Response(null, {
        status: 503,
        headers: { 'Retry-After': '30' },
      });
    return reply(
      source === resources.private_cars_1.id
        ? [{ mispar_rechev: 12345678 }]
        : [],
    );
  });
  const result = await new VehicleEngine(new CkanClient(fetcher)).discover(
    '12345678',
    signal(),
  );
  expect(result.checks).toEqual({
    registration: 'found',
    equipment: 'partial',
  });
  expect(result.reports[1].sources.cme?.httpStatus).toBe(503);
});
