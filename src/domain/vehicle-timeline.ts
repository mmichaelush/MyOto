import { resources } from '../data/sources';
import type { Scalar } from '../data/types';
import { dateLabel, dateOrder, ownershipDate } from './format';
import type { Report } from './report';

const datedFields = [
  ['rishum_rishon_dt', 'רישום ראשון'],
  ['moed_aliya_lakvish', 'עלייה לכביש'],
  ['mivchan_acharon_dt', 'טסט אחרון לפי המרשם'],
  ['bitul_dt', 'ביטול רישום'],
  ['taarich_bitzul', 'ביטול רישום'],
] as const;

function calendarValue(value: Scalar) {
  return String(value ?? '').replace(/^(\d{4})-(\d)$/, '$1-0$2');
}

export function vehicleTimeline(report: Report) {
  const events = new Map<string, { order: number; columns: string[] }>();
  if (!report.identity || report.domain !== 'registration') return [];
  for (const [field, label] of datedFields) {
    const observation = report.fields[field];
    if (!observation || observation.conflicting) continue;
    const { source, value } = observation.chosen;
    const date = calendarValue(value);
    const order = dateOrder(date);
    if (!order) continue;
    const event = {
      order,
      columns: [dateLabel(date), label, resources[source].label],
    };
    events.set([label, dateLabel(date)].join('/'), event);
  }

  // Ownership records are keyed by plate and may share the same reported period.
  const ownership = report.ownership.flatMap(({ baalut_dt, baalut }) => {
    const date = calendarValue(baalut_dt ?? null);
    const order = dateOrder(date);
    if (!order) return [];
    const quarter = /^(\d{4})(0[1-9]|1[0-2])$/.exec(date);
    const start = quarter
      ? Date.UTC(
          Number(quarter[1]),
          Math.floor((Number(quarter[2]) - 1) / 3) * 3,
        )
      : order;
    return [
      {
        order: start,
        columns: [
          ownershipDate(date),
          String(baalut ?? 'סוג לא זמין'),
          'היסטוריית בעלות לפי לוחית',
        ],
      },
    ];
  });

  return [...events.values(), ...ownership]
    .sort((a, b) => b.order - a.order)
    .map(({ columns }) => columns);
}
