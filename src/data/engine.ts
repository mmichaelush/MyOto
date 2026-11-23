import { CkanClient, RequestBudget } from './ckan';
import {
  modelFilter,
  modelSources,
  plateFilter,
  resources,
  statuses,
  ttl,
  type SourceId,
} from './sources';
import type { Scalar } from './types';
import { buildReport, type Report, type SourceReplies } from '../domain/report';
import { parsePlate, type SearchDomain } from '../domain/plate';

const regular = [
  'private_cars_1',
  'personalImport',
  'publicTransport',
  'heavy',
  'twoWheeled',
  ...statuses,
] as const;
const plateSources = [
  ...regular,
  'recall',
  'private_cars_2',
  'history_1',
  'history_2',
  'disabledPermit',
  'safetyDiscount',
  'filters',
  'busFleet',
  'anchors',
] as const;
const comparisonSources = [
  ...regular,
  'recall',
  'private_cars_2',
  'history_1',
] as const;
export const registrationRequestBudget = 28;

export type Discovery = {
  reports: Report[];
  checks: Record<SearchDomain, 'found' | 'empty' | 'partial'>;
};

export class VehicleEngine {
  constructor(private readonly client = new CkanClient()) {}

  search(
    input: string,
    domain: SearchDomain,
    signal: AbortSignal,
    update?: (report: Report) => void,
    legacyFallback = true,
  ): Promise<Report> {
    return this.lookup(
      input,
      domain,
      signal,
      new RequestBudget(domain === 'equipment' ? 6 : registrationRequestBudget),
      update,
      legacyFallback && domain === 'registration',
    );
  }

  comparison(input: string, signal: AbortSignal) {
    return this.lookup(
      input,
      'registration',
      signal,
      new RequestBudget(registrationRequestBudget),
      undefined,
      false,
      'comparison',
    );
  }

  async discover(
    input: string,
    signal: AbortSignal,
    update?: (report: Report) => void,
  ): Promise<Discovery> {
    // The two namespaces share the HTTP budget but never share source records.
    const budget = new RequestBudget(registrationRequestBudget);
    const [equipment, registration] = await Promise.all([
      this.lookup(input, 'equipment', signal, budget),
      this.lookup(input, 'registration', signal, budget, (report) => {
        if (!report.complete) update?.(report);
      }),
    ]);
    const check = (report: Report) => {
      if (report.identity && !report.sources[report.identity]?.issue)
        return 'found';
      const scope =
        report.domain === 'equipment' ? (['cme'] as const) : regular;
      return scope.every(
        (key) => report.sources[key] && !report.sources[key]?.issue,
      )
        ? 'empty'
        : 'partial';
    };
    return {
      reports: [registration, equipment],
      checks: {
        registration: check(registration),
        equipment: check(equipment),
      },
    };
  }

  private async lookup(
    input: string,
    domain: SearchDomain,
    signal: AbortSignal,
    budget: RequestBudget,
    update?: (report: Report) => void,
    legacyFallback = false,
    mode: 'full' | 'comparison' = 'full',
  ): Promise<Report> {
    const plate = parsePlate(input);
    if (!plate)
      throw new RangeError('Invalid registration or equipment number');
    const sources: SourceReplies = {};
    let published = false;
    const publish = () => {
      if (!update || published || signal.aborted) return;
      const preview = buildReport(plate, domain, sources, false);
      if (
        preview.identity &&
        !statuses.some((key) => key === preview.identity)
      ) {
        published = true;
        update(preview);
      }
    };
    const query = async (key: SourceId, filter = plateFilter(key, plate)) => {
      sources[key] = await this.client.lookup(
        resources[key],
        filter,
        signal,
        ttl(key),
        budget,
      );
      signal.throwIfAborted();
      publish();
    };
    if (domain === 'equipment') {
      await query('cme');
    } else {
      // The registration namespace covers every plate-indexed source.
      await Promise.all(
        (mode === 'comparison' ? comparisonSources : plateSources).map((key) =>
          query(key),
        ),
      );
      if (mode === 'comparison')
        return buildReport(plate, domain, sources, true);
      const discovery = buildReport(plate, domain, sources, false);
      const base = discovery.identity
        ? sources[discovery.identity]?.rows[0]
        : undefined;
      const campaignIds = [
        ...new Set(
          (sources.recall?.rows ?? [])
            .map((row) => row.RECALL_ID)
            .filter(
              (id): id is Exclude<Scalar, null | boolean> =>
                (typeof id === 'number' && id > 0) ||
                (typeof id === 'string' && id.trim().length > 0),
            ),
        ),
      ];
      const model = base ? modelFilter(base) : undefined;
      const lookups = model ? modelSources.map((key) => query(key, model)) : [];
      if (campaignIds.length)
        lookups.push(query('campaigns', { RECALL_ID: campaignIds }));
      if (
        !base &&
        legacyFallback &&
        !sources.recall?.rows.length &&
        regular.every((key) => !sources[key]?.issue)
      ) {
        // Maintain old number-only links for equipment without combining the domains.
        lookups.push(query('cme'));
      }
      await Promise.all(lookups);
    }
    const fallback =
      domain !== 'equipment' && Boolean(sources.cme?.rows.length);
    const result = buildReport(
      plate,
      fallback ? 'equipment' : domain,
      fallback ? { cme: sources.cme } : sources,
      true,
    );
    update?.(result);
    return result;
  }
}
