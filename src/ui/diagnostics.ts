import { version } from '../../package.json' with { type: 'json' };
import { fieldLabels } from '../domain/format';
import { button, element, link } from './dom';
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

function debugEnabled() {
  return new URLSearchParams(location.search).get('debug') === '1';
}

export function lookupDiagnostics(
  kind: 'search' | 'comparison',
  reports: readonly Report[],
) {
  return {
    schema: 1,
    version,
    kind,
    reports: reports.map((report) => ({
      domain: report.domain,
      outcome: report.outcome,
      statusCoverage: report.statusCoverage,
      sources: Object.entries(report.sources).map(([id, reply]) => ({
        id,
        durationMs: reply.cached ? 0 : reply.durationMs,
        cached: Boolean(reply.cached),
        httpStatus: reply.httpStatus,
        issue: reply.issue,
        records: reply.rows.length,
        upstreamUpdatedAt: /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?$/.test(
          reply.upstreamUpdatedAt ?? '',
        )
          ? reply.upstreamUpdatedAt
          : undefined,
      })),
      fields: Object.entries(report.fields).flatMap(([field, observation]) =>
        Object.hasOwn(fieldLabels, field)
          ? [
              {
                field,
                source: observation.chosen.source,
                conflicting: observation.conflicting,
                alternatives: [
                  ...new Set(
                    observation.alternatives.map(({ source }) => source),
                  ),
                ],
              },
            ]
          : [],
      ),
      excludedSources: report.separated,
      unverifiedSources: report.unverified,
    })),
  };
}

export function logLookup(
  kind: 'search' | 'comparison',
  reports: readonly Report[],
) {
  if (debugEnabled())
    console.info('[MyOto] Lookup results', lookupDiagnostics(kind, reports));
}

export function diagnosticPanel(
  kind: 'search' | 'comparison',
  reports: readonly Report[],
) {
  if (!debugEnabled()) return;
  const data = lookupDiagnostics(kind, reports);
  const panel = element('details', undefined, 'panel advanced');
  panel.dataset.lookupDiagnostics = '';
  const sources = element('ul');
  for (const report of data.reports) {
    for (const entry of report.sources) {
      const source = resources[entry.id as SourceId];
      const result = entry.issue
        ? issueText(entry.issue, entry.httpStatus)
        : `${entry.records} רשומות`;
      sources.append(
        element(
          'li',
          `${source.label} · ${result} · ${entry.cached ? 'מטמון' : entry.durationMs + ' מ״ש'}`,
        ),
      );
    }
  }
  const status = element('p');
  status.setAttribute('role', 'status');
  panel.append(
    element('summary', 'אבחון חיפוש'),
    sources,
    button('הורדת דוח אבחון', () => {
      try {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const file = link('', url);
        file.download = 'myoto-diagnostics.json';
        try {
          file.click();
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } catch {
        status.textContent = 'הדפדפן לא הצליח להוריד את דוח האבחון.';
      }
    }),
    status,
  );
  return panel;
}

export function logFailure(action: string, error: unknown) {
  console.warn('[MyOto] Operation failed', {
    action,
    type: error instanceof Error ? error.name : typeof error,
  });
}
