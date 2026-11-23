import { CkanClient, RequestBudget } from './ckan';
import {
  modelFilter,
  modelSources,
  plateFilter,
  primary,
  resources,
  ttl,
  type SourceId,
} from './sources';
import type { Scalar } from './types';
import { buildReport, type Report, type SourceReplies } from '../domain/report';
import { parsePlate, type SearchDomain } from '../domain/plate';

const discoverySources = primary.filter((key) => key !== 'cme');
const reportSources = [
  'private_cars_2',
  'history_1',
  'history_2',
  'disabledPermit',
] as const;
const supplementalSources = [
  'safetyDiscount',
  'filters',
  'busFleet',
  'anchors',
] as const;
const comparisonSources = [
  ...discoverySources,
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
  ) {
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
    const budget = new RequestBudget(registrationRequestBudget);
    let preview: Report | undefined;
    let equipmentChecked = false;
    const emitPreview = () => {
      if (equipmentChecked && preview && !signal.aborted) update?.(preview);
    };
    const equipmentLookup = this.lookup(
      input,
      'equipment',
      signal,
      budget,
    ).then((report) => {
      // Avoid previewing a regular vehicle while a collision is still possible.
      equipmentChecked = !report.identity && !report.sources.cme?.issue;
      emitPreview();
      return report;
    });
    const registrationLookup = this.lookup(
      input,
      'registration',
      signal,
      budget,
      (report) => {
        if (!report.complete) {
          preview = report;
          emitPreview();
        }
      },
    );
    const [equipment, registration] = await Promise.all([
      equipmentLookup,
      registrationLookup,
    ]);
    const check = (report: Report) => {
      if (report.identity && !report.sources[report.identity]?.issue)
        return 'found';
      const scope =
        report.domain === 'equipment' ? (['cme'] as const) : discoverySources;
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
      const priority =
        domain === 'equipment' ? (['cme'] as const) : discoverySources;
      for (const key of priority) {
        const reply = sources[key];
        if (!reply) return;
        if (reply.rows.length) {
          published = true;
          update(buildReport(plate, domain, sources, false));
          return;
        }
      }
    };
    const query = async (key: SourceId, filter = plateFilter(key, plate)) => {
      const reply = await this.client.lookup(
        resources[key],
        filter,
        signal,
        ttl(key),
        budget,
      );
      signal.throwIfAborted();
      sources[key] = reply;
      publish();
      return reply;
    };
    if (domain === 'equipment') {
      await query('cme');
    } else if (mode === 'comparison') {
      await Promise.all(comparisonSources.map((key) => query(key)));
    } else {
      const recalls = query('recall');
      const discovery = Promise.all(discoverySources.map((key) => query(key)));
      const details = Promise.all(reportSources.map((key) => query(key)));
      const campaigns = recalls.then(({ rows }) => {
        const ids = [
          ...new Set(
            rows
              .map((row) => row.RECALL_ID)
              .filter(
                (id): id is Exclude<Scalar, null | boolean> =>
                  (typeof id === 'number' && id > 0) ||
                  (typeof id === 'string' && id.trim().length > 0),
              ),
          ),
        ];
        return ids.length ? query('campaigns', { RECALL_ID: ids }) : undefined;
      });
      const supplemental = discovery.then(async () => {
        const report = buildReport(plate, domain, sources, false);
        const base = report.identity
          ? sources[report.identity]?.rows[0]
          : undefined;
        const filter = base ? modelFilter(base) : undefined;
        const requests = supplementalSources.map((key) => query(key));
        if (filter)
          requests.push(...modelSources.map((key) => query(key, filter)));
        if (
          !base &&
          legacyFallback &&
          discoverySources.every((key) => !sources[key]?.issue)
        ) {
          const recall = await recalls;
          if (!recall.rows.length) requests.push(query('cme'));
        }
        await Promise.all(requests);
      });
      await Promise.all([discovery, details, campaigns, supplemental]);
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
