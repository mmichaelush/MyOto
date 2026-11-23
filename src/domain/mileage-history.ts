import { vin } from '../data/sources';
import { dateLabel, dateOrder } from './format';
import type { Report } from './report';

export type MileageReading = { date: string; km: number };

export function readingFor(report: Report) {
  if (report.identity !== 'private_cars_1' || !report.complete) return;
  const registry = report.sources[report.identity];
  const history = report.sources.history_1;
  if (
    !registry ||
    registry.issue ||
    !history ||
    history.issue ||
    report.separated.includes(report.identity) ||
    report.unverified.includes(report.identity) ||
    report.unverified.includes('history_1')
  )
    return;
  const date = report.fields.mivchan_acharon_dt;
  const mileage = report.fields.kilometer_test_aharon;
  const identifier = registry.rows[0] && vin(registry.rows[0]);
  if (
    !identifier ||
    !date ||
    date.conflicting ||
    date.chosen.source !== report.identity ||
    !mileage ||
    mileage.conflicting ||
    mileage.chosen.source !== 'history_1'
  )
    return;
  const formatted = dateLabel(date.chosen.value);
  const km = Number(mileage.chosen.value);
  if (
    !/^\d{2}\/\d{2}\/\d{4}$/.test(formatted) ||
    !dateOrder(date.chosen.value) ||
    !Number.isSafeInteger(km) ||
    km <= 0
  )
    return;
  const [day, month, year] = formatted.split('/');
  return { identifier, reading: { date: [year, month, day].join('-'), km } };
}

export function previousReading(
  readings: readonly MileageReading[],
  current: MileageReading,
) {
  return readings
    .filter(({ date }) => date < current.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}
