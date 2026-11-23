import {
  identityConflict,
  primary,
  resources,
  statuses,
  type SourceId,
} from '../data/sources';
import type { Reply, Row, Scalar } from '../data/types';
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
  fields: Record<string, Field>;
  sources: SourceReplies;
  status: 'listed' | 'inactive' | 'cancelled' | 'conflicting' | 'unknown';
  outcome: 'found' | 'empty' | 'partial' | 'pending';
  ownership: Row[];
  recalls: Row[];
};

const aliases: Record<string, string> = {
  production_country: 'tozeret_eretz_nm',
  nefah_manoa: 'nefach_manoa',
  SeatsNum: 'mispar_moshavim',
  delek_nm: 'sug_delek_nm',
};
const supplementary = ['private_cars_2', 'history_1', 'filters'] as const;

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
  const available = primary.filter((key) => sources[key]?.rows.length);
  const identity = available[0];
  const base = identity ? sources[identity]?.rows[0] : undefined;
  const separated = base
    ? available.filter(
        (key) =>
          key !== identity &&
          sources[key]?.rows.some((row) => identityConflict(base, row)),
      )
    : [];
  const statusSources = available.filter((key) =>
    statuses.some((status) => status === key),
  );
  const listed = available.some(
    (key) =>
      !statusSources.includes(key) && key !== 'cme' && key !== 'personalImport',
  );
  const status =
    listed && statusSources.length
      ? 'conflicting'
      : statusSources.some((key) => key.startsWith('offRoad'))
        ? 'cancelled'
        : statusSources.length
          ? 'inactive'
          : listed
            ? 'listed'
            : 'unknown';
  const fields: Record<string, Field> = Object.create(null);
  if (base) {
    for (const key of [...available, ...supplementary]) {
      const source = sources[key];
      if (!source) continue;
      for (const row of uniqueRows(source.rows)) {
        if (identityConflict(base, row)) continue;
        for (const [name, raw] of Object.entries(row)) {
          if (name === '_id') continue;
          const field = Object.hasOwn(aliases, name) ? aliases[name] : name;
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
            current.alternatives.push(observation);
            current.conflicting ||=
              String(current.chosen.value) !== String(value);
          }
        }
      }
    }
  }
  const partial = Object.values(sources).some((reply) => reply.issue);
  const newest = (field: string) => (a: Row, b: Row) =>
    String(b[field] ?? '').localeCompare(String(a[field] ?? ''));
  return {
    plate,
    domain,
    complete,
    sources: { ...sources },
    identity,
    separated,
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
