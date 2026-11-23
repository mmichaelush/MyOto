import { CkanClient, RequestBudget } from './ckan';
import {
  identityMatch,
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
export const registrationRequestBudget = 28;

export class VehicleEngine {
  constructor(private readonly client = new CkanClient()) {}

  async search(
    input: string,
    domain: SearchDomain,
    signal: AbortSignal,
    update?: (report: Report) => void,
  ): Promise<Report> {
    const plate = parsePlate(input);
    if (!plate)
      throw new RangeError('Invalid registration or equipment number');
    const sources: SourceReplies = {};
    const budget = new RequestBudget(
      domain === 'equipment' ? 6 : registrationRequestBudget,
    );
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
      await Promise.all(regular.map((key) => query(key)));
      const discovery = buildReport(plate, domain, sources, false);
      const base = discovery.identity
        ? sources[discovery.identity]?.rows[0]
        : undefined;
      if (base) {
        const isType = (key: SourceId) =>
          discovery.identity === key ||
          sources[key]?.rows.some(
            (row) => identityMatch(base, row) === 'verified',
          );
        const lookups: Promise<void>[] = [
          query('recall'),
          query('disabledPermit'),
        ];
        if (
          isType('private_cars_1') ||
          isType('frozen_with_model') ||
          isType('offRoad_1')
        ) {
          lookups.push(
            query('history_1'),
            query('history_2'),
            query('safetyDiscount'),
          );
        }
        if (isType('private_cars_1')) lookups.push(query('private_cars_2'));
        if (
          isType('publicTransport') &&
          sources.publicTransport?.rows.some((row) =>
            /^אוטובוס/.test(String(row.sug_rechev_nm ?? '')),
          )
        ) {
          lookups.push(query('busFleet'));
        }
        if (isType('heavy') || isType('publicTransport'))
          lookups.push(query('anchors'));
        if (
          isType('heavy') ||
          isType('publicTransport') ||
          (isType('private_cars_1') &&
            /דיזל/.test(String(base.sug_delek_nm ?? '')))
        )
          lookups.push(query('filters'));
        const filters = modelFilter(base);
        if (filters)
          lookups.push(...modelSources.map((key) => query(key, filters)));
        await Promise.all(lookups);
        const campaignIds = [
          ...new Set(
            sources.recall?.rows
              .map((row) => row.RECALL_ID)
              .filter(
                (id): id is Exclude<Scalar, null | boolean> =>
                  (typeof id === 'number' && id > 0) ||
                  (typeof id === 'string' && id.trim().length > 0),
              ),
          ),
        ];
        if (campaignIds.length)
          await query('campaigns', { RECALL_ID: campaignIds });
      } else if (
        !sources.private_cars_1?.issue &&
        regular.every((key) => !sources[key]?.issue)
      ) {
        // Maintain old number-only links for equipment without combining the domains.
        await query('cme');
      }
    }
    const result = buildReport(
      plate,
      sources.cme?.rows.length ? 'equipment' : domain,
      sources,
      true,
    );
    update?.(result);
    return result;
  }
}
