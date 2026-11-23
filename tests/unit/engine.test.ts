import { expect, test, vi } from 'vitest';
import { CkanClient } from '../../src/data/ckan';
import { VehicleEngine } from '../../src/data/engine';
import { plateFilter, resources } from '../../src/data/sources';
import type { Filter, Row } from '../../src/data/types';
import { buildReport } from '../../src/domain/report';
import { dateLabel, quarter } from '../../src/domain/format';

const valid = (records: Row[]) =>
  Response.json({ success: true, result: { limit: 50, records } });
const fetchedAt = '2026-11-23T10:00:00Z';
const reply = (rows: Row[]) => ({ rows, fetchedAt, durationMs: 1 });

test('preserves archive padding and keeps the equipment key distinct', () => {
  expect(plateFilter('offRoad_2', '0123456')).toEqual({
    mispar_rechev: ['0123456', '00123456'],
  });
  expect(plateFilter('cme', '0123456')).toEqual({ mispar_tzama: 123456 });
  expect(plateFilter('disabledPermit', '0123456')).toEqual({
    'MISPAR RECHEV': 123456,
  });
});

test('retains zero and source provenance and separates conflicting identities', () => {
  const sources = {
    private_cars_1: reply([
      {
        shnat_yitzur: 2020,
        misgeret: 'ABC12345',
        ramat_gimur: 'New',
        degem_cd: 5,
        tozeret_cd: 2,
        sug_degem: 'P',
      },
    ]),
    private_cars_2: reply([
      {
        ramat_gimur: 'Different',
        degem_cd: '0005',
        gapam_ind: 0,
        tozeret_cd: '002',
        sug_degem: 'P',
      },
    ]),
    offRoad_2: reply([
      { shnat_yitzur: 2018, misgeret: 'DEF54321', mehir: 100 },
    ]),
    heavy: reply([]),
    publicTransport: reply([]),
    twoWheeled: reply([]),
    offRoad_1: reply([]),
    offRoad_3: reply([]),
    frozen_with_model: reply([]),
    frozen_no_model: reply([]),
  };
  const report = buildReport('0123456', 'registration', sources, true);
  expect(report.status).toBe('listed');
  expect(report.separated).toEqual(['offRoad_2']);
  expect(report.fields.mehir).toBeUndefined();
  expect(report.fields.gapam_ind.chosen).toMatchObject({
    raw: 0,
    value: 0,
    resourceId: resources.private_cars_2.id,
    fetchedAt,
  });
  expect(report.fields.ramat_gimur).toMatchObject({
    chosen: { value: 'New' },
    conflicting: true,
  });
  expect(report.fields.degem_cd.conflicting).toBe(false);
  const same = buildReport(
    '0123456',
    'registration',
    {
      ...sources,
      offRoad_2: reply([{ misgeret: 'ABC12345' }]),
    },
    true,
  );
  expect(same.status).toBe('conflicting');
  const missing = buildReport(
    '0123456',
    'registration',
    { ...sources, frozen_no_model: { ...reply([]), issue: 'http' } },
    true,
  );
  expect(missing.status).toBe('unknown');
  expect(missing.statusCoverage).toBe('partial');
});

test('recognizes the research response shapes and preserves ownership multiplicity', async () => {
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const search = new URL(String(input)).searchParams;
    const source = search.get('resource_id');
    const filter = JSON.parse(search.get('filters') ?? '{}') as Filter;
    if (source === resources.private_cars_1.id)
      return valid([{ mispar_rechev: 123456, tozeret_nm: 'יצרן' }]);
    if (source === resources.history_2.id)
      return valid([
        { _id: 1, mispar_rechev: 123456, baalut_dt: 201701, baalut: 'פרטי' },
        { _id: 2, mispar_rechev: 123456, baalut_dt: 201802, baalut: 'סוחר' },
        { _id: 3, mispar_rechev: 123456, baalut_dt: 201803, baalut: 'פרטי' },
      ]);
    if (source === resources.offRoad_2.id)
      return new Response('<!doctype html>', { status: 404 });
    if (source === resources.recall.id)
      return valid([{ MISPAR_RECHEV: 123456, RECALL_ID: 15781 }]);
    if (source === resources.campaigns.id) {
      expect(filter).toEqual({ RECALL_ID: [15781] });
      return valid([{ RECALL_ID: 15781 }]);
    }
    return valid([]);
  });
  const publish = vi.fn();
  const report = await new VehicleEngine(new CkanClient(fetcher)).search(
    '0123456',
    'registration',
    new AbortController().signal,
    publish,
  );
  expect(report.outcome).toBe('found');
  expect(report.sources.offRoad_2?.issue).toBe('http');
  expect(report.ownership.map((row) => row.baalut_dt)).toEqual([
    201803, 201802, 201701,
  ]);
  expect(report.recalls).toHaveLength(1);
  expect(
    publish.mock.calls.some(([value]) => value.identity && !value.complete),
  ).toBe(true);
  expect(
    fetcher.mock.calls.some(([url]) => String(url).includes(resources.cme.id)),
  ).toBe(false);
});

test('shares a lookup, cancels a subscriber and caches the successful reply', async () => {
  let release: (response: Response) => void = () => {};
  const fetcher = vi.fn<typeof fetch>(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const client = new CkanClient(fetcher);
  const controller = new AbortController();
  const keep = new AbortController().signal;
  const query = { mispar_rechev: 123456 };
  const first = client.lookup(
    resources.private_cars_1,
    query,
    controller.signal,
  );
  const second = client.lookup(resources.private_cars_1, query, keep);
  const rejected = expect(first).rejects.toHaveProperty('name', 'AbortError');
  controller.abort();
  release(valid([{ mispar_rechev: 123456 }]));
  await rejected;
  expect(await second).toMatchObject({ rows: [{ mispar_rechev: 123456 }] });
  await client.lookup(resources.private_cars_1, query, keep);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('reports timeout, malformed payload and unexpected rows separately', async () => {
  const keep = new AbortController().signal;
  const lookup = (fetcher: typeof fetch) =>
    new CkanClient(fetcher, 1, 10).lookup(
      resources.private_cars_1,
      { mispar_rechev: 123456 },
      keep,
    );
  expect((await lookup(async () => new Response('<html>'))).issue).toBe(
    'invalid-response',
  );
  expect(
    (await lookup(async () => valid([{ mispar_rechev: 654321 }]))).issue,
  ).toBe('schema');
  expect(
    (
      await lookup(
        async (_input, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(init.signal?.reason),
              { once: true },
            );
            setTimeout(
              () => reject(new Error('deadline did not abort the request')),
              75,
            );
          }),
      )
    ).issue,
  ).toBe('timeout');
});

test('formats dates without shifting them and represents periods at source precision', () => {
  expect(dateLabel('20260307')).toBe('07/03/2026');
  expect(dateLabel('2026-03')).toBe('03/2026');
  expect(dateLabel('20260230')).toBe('20260230');
  expect(quarter(201803)).toBe('רבעון 1, 2018');
  expect(quarter(201804)).toBe('רבעון 2, 2018');
});

test('checks an unmatched legacy number for equipment without mixing namespaces', async () => {
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const search = new URL(String(input)).searchParams;
    return valid(
      search.get('resource_id') === resources.cme.id
        ? [{ mispar_tzama: 123456 }]
        : [],
    );
  });
  const result = await new VehicleEngine(new CkanClient(fetcher)).search(
    '0123456',
    'registration',
    new AbortController().signal,
  );
  expect(result).toMatchObject({
    domain: 'equipment',
    identity: 'cme',
    outcome: 'found',
  });
  expect(result.sources.recall).toBeUndefined();
});

test('bounds concurrent requests and fetches all ownership pages without collapsing repeated events', async () => {
  let active = 0;
  let maxActive = 0;
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    active++;
    maxActive = Math.max(active, maxActive);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    const params = new URL(String(input)).searchParams;
    const plate = JSON.parse(params.get('filters') ?? '{}').mispar_rechev;
    const offset = Number(params.get('offset'));
    return valid(
      Array.from({ length: offset === 0 ? 50 : 3 }, (_, index) => ({
        _id: offset + index,
        mispar_rechev: plate,
        baalut: 'סוחר',
        baalut_dt: 202601,
      })),
    );
  });
  const client = new CkanClient(fetcher, 2);
  const signal = new AbortController().signal;
  const results = await Promise.all(
    [123456, 234567, 345678, 456789].map((plate) =>
      client.lookup(resources.history_2, { mispar_rechev: plate }, signal),
    ),
  );
  expect(maxActive).toBe(2);
  expect(fetcher).toHaveBeenCalledTimes(8);
  expect(results.map((result) => result.rows.length)).toEqual([53, 53, 53, 53]);
});
