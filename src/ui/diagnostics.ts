import { resources, type SourceId } from '../data/sources';
import type { Report } from '../domain/report';
import { issueText } from '../domain/diagnostics';

export function failedSources(reports: readonly Report[]) {
  return reports.flatMap(({ sources, domain }) =>
    Object.entries(sources).flatMap(([id, reply]) =>
      reply.issue
        ? [
            {
              domain,
              id,
              name: resources[id as SourceId].label,
              issue: reply.issue,
              httpStatus: reply.httpStatus,
              durationMs: reply.durationMs,
              text: issueText(reply.issue, reply.httpStatus),
            },
          ]
        : [],
    ),
  );
}

export function logLookup(
  kind: 'search' | 'comparison',
  reports: readonly Report[],
) {
  const failures = failedSources(reports);
  if (failures.length)
    console.warn('[MyOto] Lookup sources unavailable', { kind, failures });
  if (new URLSearchParams(location.search).get('debug') === '1') {
    console.info('[MyOto] Lookup results', {
      kind,
      reports: reports.map(({ domain, outcome, sources }) => ({
        domain,
        outcome,
        sources: Object.entries(sources).map(([id, reply]) => ({
          id,
          durationMs: reply.durationMs,
          httpStatus: reply.httpStatus,
          issue: reply.issue,
          rows: reply.rows.length,
        })),
      })),
    });
  }
}

export function logFailure(action: string, error: unknown) {
  console.warn('[MyOto] Operation failed', {
    action,
    type: error instanceof Error ? error.name : typeof error,
  });
}
