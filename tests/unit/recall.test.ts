import { expect, test, vi } from 'vitest';
import { CkanClient } from '../../src/data/ckan';
import {
  VehicleEngine,
  registrationRequestBudget,
} from '../../src/data/engine';
import { resources } from '../../src/data/sources';
import type { Row } from '../../src/data/types';
import { recallView } from '../../src/presentation/recall-view';

const signal = () => new AbortController().signal;
const reply = (...records: Row[]) =>
  Response.json({ success: true, result: { records } });
const plate = '11234567';
const recall = {
  MISPAR_RECHEV: Number(plate),
  RECALL_ID: 501,
  SUG_TAKALA: 'בלמים',
};

test('automatic lookup queries all 20 plate sources and links recall campaigns by exact ID', async () => {
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const params = new URL(String(input)).searchParams;
    const filter = JSON.parse(params.get('filters') ?? '{}');
    if (params.get('resource_id') === resources.recall.id) {
      expect(filter).toEqual({ MISPAR_RECHEV: Number(plate) });
      return reply(recall);
    }
    if (params.get('resource_id') === resources.campaigns.id) {
      expect(filter).toEqual({ RECALL_ID: [501] });
      return reply({
        RECALL_ID: 501,
        OFEN_TIKUN: 'החלפת רכיב',
        YEVUAN_TEUR: 'יבואן א׳',
      });
    }
    return reply();
  });
  const {
    reports: [report],
  } = await new VehicleEngine(new CkanClient(fetcher)).discover(
    '112-34-567',
    signal(),
  );
  const requested = fetcher.mock.calls.map(([url]) =>
    new URL(String(url)).searchParams.get('resource_id'),
  );
  const expected = [
    'private_cars_1',
    'private_cars_2',
    'personalImport',
    'heavy',
    'publicTransport',
    'twoWheeled',
    'offRoad_1',
    'offRoad_2',
    'offRoad_3',
    'frozen_with_model',
    'frozen_no_model',
    'recall',
    'history_1',
    'history_2',
    'disabledPermit',
    'safetyDiscount',
    'filters',
    'busFleet',
    'anchors',
    'cme',
    'campaigns',
  ] as const;
  expect(requested.sort()).toEqual(
    expected.map((key) => resources[key].id).sort(),
  );
  expect(report.identity).toBeUndefined();
  expect(recallView(report)).toMatchObject({
    state: 'found',
    notices: [{ id: '501', repair: 'החלפת רכיב', importer: 'יבואן א׳' }],
  });
});

test.each([false, true])(
  'separates no recall from a failed endpoint (failure %s)',
  async (failed) => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      failed && String(url).includes(resources.recall.id)
        ? new Response(null, { status: 404 })
        : reply(),
    );
    const {
      reports: [report],
    } = await new VehicleEngine(new CkanClient(fetcher)).discover(
      plate,
      signal(),
    );
    expect(recallView(report).state).toBe(failed ? 'unavailable' : 'empty');
    expect(fetcher).toHaveBeenCalledTimes(20);
  },
);

test('never accepts recall rows from another registration number', async () => {
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    String(url).includes(resources.recall.id)
      ? reply({ ...recall, MISPAR_RECHEV: 99999999 })
      : reply(),
  );
  const {
    reports: [report],
  } = await new VehicleEngine(new CkanClient(fetcher)).discover(
    plate,
    signal(),
  );
  expect(report.sources.recall?.issue).toBe('schema');
  expect(recallView(report)).toMatchObject({
    state: 'unavailable',
    notices: [],
  });
  expect(fetcher).toHaveBeenCalledTimes(20);
});

test('discovers plate-based recalls independently of missing vehicle identity', async () => {
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const source = new URL(String(input)).searchParams.get('resource_id');
    if (source === resources.recall.id) return reply(recall);
    if (source === resources.cme.id)
      return reply({ mispar_tzama: Number(plate), sug_tzama_nm: 'מחפר' });
    if (source === resources.campaigns.id)
      return new Response(null, { status: 404 });
    return reply();
  });
  const discovery = await new VehicleEngine(new CkanClient(fetcher)).discover(
    plate,
    signal(),
  );
  const [registration, equipment] = discovery.reports;
  expect(discovery.checks).toEqual({
    registration: 'empty',
    equipment: 'found',
  });
  expect(registration.identity).toBeUndefined();
  expect(recallView(registration).state).toBe('found');
  expect(recallView(registration).campaignUnavailable).toBe(true);
  expect(recallView(registration).notices[0].title).toBe('בלמים');
  expect(equipment.sources.recall).toBeUndefined();
  expect(fetcher.mock.calls.length).toBeLessThanOrEqual(
    registrationRequestBudget,
  );
});
