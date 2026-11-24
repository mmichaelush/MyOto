import { dateLabel } from '../domain/format';
import type { Report } from '../domain/report';
import type { Row } from '../data/types';

function sharedCampaignValue(rows: Row[], key: string) {
  const values = new Set(rows.map((row) => String(row[key] ?? '').trim()));
  values.delete('');
  return values.size === 1 ? [...values][0] : '';
}

export function recallView(report: Report) {
  const lookup = report.sources.recall;
  const notices = report.recalls.map((row) => {
    const identifier = String(row.RECALL_ID ?? '');
    const campaign = identifier
      ? (report.sources.campaigns?.rows ?? []).filter(
          (candidate) => String(candidate.RECALL_ID) === identifier,
        )
      : [];
    const detail = (key: string) => sharedCampaignValue(campaign, key);
    return {
      id: identifier,
      title: String(row.SUG_TAKALA || detail('SUG_TAKALA') || 'קריאת שירות'),
      type: String(row.SUG_RECALL || detail('SUG_RECALL')),
      opened: row.TAARICH_PTICHA ? dateLabel(row.TAARICH_PTICHA) : undefined,
      description: String(row.TEUR_TAKALA || detail('TEUR_TAKALA')),
      repair: detail('OFEN_TIKUN'),
      importer: detail('YEVUAN_TEUR'),
      phone: detail('TELEPHONE'),
      website: detail('WEBSITE'),
    };
  });
  return {
    state: notices.length
      ? 'found'
      : !lookup || lookup.issue
        ? 'unavailable'
        : 'empty',
    incomplete: Boolean(lookup?.issue),
    campaignUnavailable: Boolean(report.sources.campaigns?.issue),
    notices,
  } as const;
}
