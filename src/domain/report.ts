import {
  engineMatch,
  identityMatch,
  privateContinuation,
  primary,
  resources,
  statuses,
  type SourceId,
} from '../data/sources';
import type { Reply, Row, Scalar } from '../data/types';
import { dateOrder } from './format';
import type { SearchDomain } from './plate';

export type SourceReplies = Partial<Record<SourceId, Reply>>;
export type Observation = {
  field: string;
  value: Exclude<Scalar, null>;
  raw: Scalar;
  source: SourceId;
  resourceId: string;
  fetchedAt: string;
  upstreamUpdatedAt?: string;
  confidence: 'registry' | 'supplement';
};
export type Field = {
  chosen: Observation;
  alternatives: Observation[];
  conflicting: boolean;
};
export type Report = {
  plate: string;
  domain: SearchDomain;
  complete: boolean;
  identity?: SourceId;
  separated: SourceId[];
  unverified: SourceId[];
  statusCoverage: 'complete' | 'partial' | 'pending' | 'not-applicable';
  historyByPlate: boolean;
  fields: Record<string, Field>;
  sources: SourceReplies;
  status: 'listed' | 'inactive' | 'cancelled' | 'conflicting' | 'unknown';
  outcome: 'found' | 'empty' | 'partial' | 'pending';
  ownership: Row[];
  recalls: Row[];
};

const observations = ['private_cars_2', 'history_1'] as const;
const active = new Set<SourceId>([
  'private_cars_1',
  'publicTransport',
  'twoWheeled',
  'heavy',
]);
const archived = new Set<SourceId>(statuses);

function fieldPriority(
  field: string,
  source: SourceId,
  identity: SourceId | undefined,
) {
  if (field === 'bitul_dt' || field === 'taarich_bitzul')
    return archived.has(source) ? 0 : 4;
  if (field === 'kilometer_test_aharon') return source === 'history_1' ? 0 : 4;
  if (
    field === 'tokef_dt' ||
    field === 'mivchan_acharon_dt' ||
    field === 'baalut'
  ) {
    return active.has(source) ? (source === identity ? 0 : 1) : 4;
  }
  if (source === identity) return 0;
  return active.has(source)
    ? 1
    : archived.has(source) || source === 'personalImport'
      ? 2
      : 3;
}

export function rowKey(row: Row): string {
  return JSON.stringify(
    Object.entries(row)
      .filter(([key]) => key !== '_id')
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function uniqueRows(rows: Row[]): Row[] {
  return [...new Map(rows.map((row) => [rowKey(row), row])).values()];
}

function normalized(field: string, raw: Scalar) {
  if (typeof raw !== 'string') return raw;
  const value = raw.trim();
  if (
    (field.endsWith('_cd') || field === 'shnat_yitzur') &&
    /^\d+$/.test(value)
  )
    return Number(value);
  return value;
}

export function buildReport(
  plate: string,
  domain: SearchDomain,
  sources: SourceReplies,
  complete: boolean,
): Report {
  const available = primary.filter(
    (key) =>
      (key === 'cme') === (domain === 'equipment') && sources[key]?.rows.length,
  );
  const identity = available[0];
  const base = identity ? sources[identity]?.rows[0] : undefined;
  const separated = new Set<SourceId>();
  const unverified = new Set<SourceId>();
  const accepted = new Map<SourceId, Row[]>();
  if (base) {
    for (const key of available) {
      for (const row of uniqueRows(sources[key]?.rows ?? [])) {
        const match =
          key === identity && rowKey(base) === rowKey(row)
            ? 'verified'
            : identityMatch(base, row);
        if (match === 'different') separated.add(key);
        else if (match !== 'verified') unverified.add(key);
        else accepted.set(key, [...(accepted.get(key) ?? []), row]);
      }
    }
    if (
      identity === 'private_cars_1' &&
      !separated.has(identity) &&
      !unverified.has(identity)
    ) {
      for (const key of observations) {
        const rows = uniqueRows(sources[key]?.rows ?? []);
        const compatible = rows.filter((row) =>
          key === 'private_cars_2'
            ? privateContinuation(base, row)
            : engineMatch(base, row),
        );
        if (compatible.length === 1) accepted.set(key, compatible);
        if (rows.length !== compatible.length || compatible.length > 1)
          unverified.add(key);
      }
    }
  }
  const keys = [...accepted.keys()];
  const listed = keys.some((key) => active.has(key));
  const cancelled = keys.some((key) => key.startsWith('offRoad'));
  const inactive = keys.some((key) => key.startsWith('frozen'));
  const statusCoverage =
    domain === 'equipment'
      ? 'not-applicable'
      : [...active, ...statuses].some((key) => sources[key]?.issue)
        ? 'partial'
        : [...active, ...statuses].every((key) => sources[key])
          ? 'complete'
          : complete
            ? 'partial'
            : 'pending';
  const uncertainStatus = [...unverified].some(
    (key) => active.has(key) || archived.has(key),
  );
  const status =
    listed && (cancelled || inactive)
      ? 'conflicting'
      : statusCoverage !== 'complete' ||
          uncertainStatus ||
          (identity && separated.has(identity))
        ? 'unknown'
        : cancelled
          ? 'cancelled'
          : inactive
            ? 'inactive'
            : listed
              ? 'listed'
              : 'unknown';
  const fields: Record<string, Field> = Object.create(null);
  if (base) {
    for (const [key, rows] of accepted) {
      const source = sources[key];
      if (!source) continue;
      for (const row of rows) {
        for (const [name, raw] of Object.entries(row)) {
          if (name === '_id') continue;
          const field = name;
          const value = normalized(field, raw);
          if (value === null || value === '') continue;
          const observation: Observation = {
            field: name,
            raw,
            value,
            source: key,
            resourceId: resources[key].id,
            fetchedAt: source.fetchedAt,
            upstreamUpdatedAt: source.upstreamUpdatedAt,
            confidence: available.includes(key as (typeof primary)[number])
              ? 'registry'
              : 'supplement',
          };
          const current = fields[field];
          if (!current)
            fields[field] = {
              chosen: observation,
              alternatives: [],
              conflicting: false,
            };
          else {
            current.conflicting ||=
              String(current.chosen.value) !== String(value);
            if (
              fieldPriority(field, key, identity) <
              fieldPriority(field, current.chosen.source, identity)
            ) {
              current.alternatives.push(current.chosen);
              current.chosen = observation;
            } else current.alternatives.push(observation);
          }
        }
      }
    }
  }
  const partial = Object.values(sources).some((reply) => reply.issue);
  const newest = (field: string) => (a: Row, b: Row) =>
    dateOrder(b[field]) - dateOrder(a[field]);
  return {
    plate,
    domain,
    complete,
    sources: { ...sources },
    identity,
    separated: [...separated],
    unverified: [...unverified],
    statusCoverage,
    historyByPlate: Boolean(
      sources.history_2?.rows.length ||
      (sources.history_1?.rows.length && !accepted.has('history_1')),
    ),
    fields,
    status,
    outcome: identity
      ? 'found'
      : !complete
        ? 'pending'
        : partial
          ? 'partial'
          : 'empty',
    ownership: [...(sources.history_2?.rows ?? [])].sort(newest('baalut_dt')),
    recalls: uniqueRows(sources.recall?.rows ?? []).sort(
      newest('TAARICH_PTICHA'),
    ),
  };
}
