import { endpoint } from '../data/ckan';

export function directoryKey(value: string) {
  return value
    .normalize('NFKC')
    .replace(/["״׳']/g, '')
    .replace(/[\s-]+/g, ' ')
    .trim();
}

export async function readDirectory<K extends string>(
  resourceId: string,
  fields: readonly K[],
  signal: AbortSignal,
  filters?: Record<string, string | number>,
): Promise<Record<K, unknown>[]> {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    resource_id: resourceId,
    ...(filters && { filters: JSON.stringify(filters) }),
    fields: fields.join(','),
    sort: '_id asc',
    limit: '20000',
    include_total: 'true',
    total_estimation_threshold: '100000',
  }).toString();
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  if (!response.ok) throw new Error('Directory unavailable');
  const body = await response.json();
  const frame = body.result;
  if (
    body.success !== true ||
    !Array.isArray(frame?.records) ||
    frame.total_was_estimated ||
    frame.records.length !== frame.total
  )
    throw new Error('Directory response incomplete');
  return frame.records;
}
