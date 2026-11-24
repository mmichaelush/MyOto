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

export type DiscoveryPreview =
  | { kind: 'registration' | 'recall'; report: Report }
  | { kind: 'collision'; reports: [Report, Report] };

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
    update?: (preview: DiscoveryPreview) => void,
  ): Promise<Discovery> {
    const budget = new RequestBudget(registrationRequestBudget);
    let registrationPreview: Report | undefined;
    let equipmentPreview: Report | undefined;
    let shown: DiscoveryPreview['kind'] | undefined;
    const emitPreview = () => {
      if (
        !update ||
        !registrationPreview ||
        !equipmentPreview ||
        signal.aborted
      )
        return;
      const report = registrationPreview;
      const equipment = equipmentPreview;
      const matched = report.identity || report.recalls.length;
      const preview: DiscoveryPreview | undefined =
        matched && equipment.identity
          ? { kind: 'collision', reports: [report, equipment] }
          : report.identity && !equipment.sources.cme?.issue
            ? { kind: 'registration', report }
            : report.recalls.length
              ? { kind: 'recall', report }
              : undefined;
      if (preview && shown !== preview.kind) {
        shown = preview.kind;
        update(preview);
      }
    };
    const equipmentLookup = this.lookup(
      input,
      'equipment',
      signal,
      budget,
    ).then((report) => {
      equipmentPreview = report;
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
          registrationPreview = report;
          emitPreview();
        }
      },
      false,
      'full',
      true,
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
    previewRecall = false,
  ): Promise<Report> {
    const plate = parsePlate(input);
    if (!plate)
      throw new RangeError('Invalid registration or equipment number');
    const sources: SourceReplies = {};
    let elected = false;
    let selectIdentity: ((key?: SourceId) => void) | undefined;
    const elect = () => {
      if (elected || signal.aborted) return;
      const priority =
        domain === 'equipment' ? (['cme'] as const) : discoverySources;
      for (const key of priority) {
        const reply = sources[key];
        if (!reply) return;
        if (reply.rows.length) {
          elected = true;
          selectIdentity?.(key);
          update?.(buildReport(plate, domain, sources, false));
          return;
        }
      }
      elected = true;
      selectIdentity?.();
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
      elect();
      return reply;
    };
    if (domain === 'equipment') {
      await query('cme');
    } else if (mode === 'comparison') {
      await Promise.all(comparisonSources.map((key) => query(key)));
    } else {
      const identity = new Promise<SourceId | undefined>((resolve) => {
        selectIdentity = resolve;
      });
      const recalls = query('recall');
      const discovery = Promise.all(discoverySources.map((key) => query(key)));
      const details = Promise.all(reportSources.map((key) => query(key)));
      const supplemental = Promise.all(
        supplementalSources.map((key) => query(key)),
      );
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
      const specs = identity.then(async (key) => {
        const base = key ? sources[key]?.rows[0] : undefined;
        const filter = base ? modelFilter(base) : undefined;
        if (filter)
          await Promise.all(modelSources.map((key) => query(key, filter)));
        if (!key) {
          const recall = await recalls;
          if (previewRecall && recall.rows.length)
            update?.(buildReport(plate, domain, sources, false));
          if (
            legacyFallback &&
            !recall.rows.length &&
            discoverySources.every((source) => !sources[source]?.issue)
          )
            await query('cme');
        }
      });
      await Promise.all([discovery, details, campaigns, supplemental, specs]);
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
