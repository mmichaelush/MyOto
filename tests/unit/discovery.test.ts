import { expect, test, vi } from 'vitest';
import { CkanClient } from '../../src/data/ckan';
import {
  VehicleEngine,
  registrationRequestBudget,
  type DiscoveryPreview,
} from '../../src/data/engine';
import { resources } from '../../src/data/sources';
import type { Row } from '../../src/data/types';

const signal = () => new AbortController().signal;
const reply = (records: Row[]) =>
  Response.json({ success: true, result: { records } });

test('starts enrichments for a confirmed identity without waiting for unrelated registries', async () => {
  const ids: string[] = [];
  let resolveCme!: (response: Response) => void;
  let resolveAnchors!: (response: Response) => void;
  let resolveArchive!: (response: Response) => void;
  const cme = new Promise<Response>((resolve) => {
    resolveCme = resolve;
  });
  const anchors = new Promise<Response>((resolve) => {
    resolveAnchors = resolve;
  });
  const archive = new Promise<Response>((resolve) => {
    resolveArchive = resolve;
  });
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const source = new URL(String(input)).searchParams.get('resource_id')!;
    ids.push(source);
    if (source === resources.cme.id) return cme;
    if (source === resources.anchors.id) return anchors;
    if (source === resources.offRoad_3.id) return archive;
    return reply(
      source === resources.private_cars_1.id
        ? [
            {
              mispar_rechev: 12345678,
              tozeret_nm: 'רכב לדוגמה',
              sug_degem: 'P',
              tozeret_cd: 10,
              degem_cd: 20,
              shnat_yitzur: 2020,
            },
          ]
        : [],
    );
  });
  const update = vi.fn<(preview: DiscoveryPreview) => void>();
  const result = new VehicleEngine(new CkanClient(fetcher)).discover(
    '12345678',
    signal(),
    update,
  );
  try {
    await vi.waitFor(() => expect(ids).toContain(resources.private_cars_1.id));
    expect(update).not.toHaveBeenCalled();
    resolveCme(reply([]));
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0]).toMatchObject({
      kind: 'registration',
      report: { identity: 'private_cars_1', complete: false },
    });
    await vi.waitFor(() => expect(ids).toContain(resources.modelDetails.id));
    await vi.waitFor(() => expect(ids).toContain(resources.anchors.id));
    resolveArchive(reply([]));
    resolveAnchors(reply([{ mispar_rechev: 12345678 }]));
    const { reports } = await result;
    expect(reports[0].sources.anchors?.rows).toHaveLength(1);
    expect(reports[0].complete).toBe(true);
    expect(ids).toHaveLength(23);
  } finally {
    resolveCme(reply([]));
    resolveAnchors(reply([]));
    resolveArchive(reply([]));
    await result;
  }
});

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

test('comparison fetches the full registration history and model enrichment', async () => {
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const id = new URL(String(input)).searchParams.get('resource_id');
    return reply(
      id === resources.private_cars_1.id
        ? [
            {
              mispar_rechev: 12345678,
              tozeret_cd: 10,
              degem_cd: 20,
              sug_degem: 'P',
              shnat_yitzur: 2021,
            },
          ]
        : id === resources.recall.id
          ? [{ MISPAR_RECHEV: 12345678, RECALL_ID: 90 }]
          : [],
    );
  });
  const report = await new VehicleEngine(new CkanClient(fetcher)).comparison(
    '12345678',
    signal(),
  );
  expect(fetcher).toHaveBeenCalledTimes(23);
  expect(report.recalls).toHaveLength(1);
  for (const key of [
    'campaigns',
    'modelDetails',
    'modelCounts',
    'history_2',
    'disabledPermit',
    'anchors',
  ] as const)
    expect(report.sources[key]).toBeDefined();
  expect(report.sources.cme).toBeUndefined();
});
