import labels from './labels.json' with { type: 'json' };
import type { Scalar } from '../data/types';

export const fieldLabels: Record<
  string,
  { label: string; category: string; format?: string; max?: number }
> = labels;
const number = new Intl.NumberFormat('he-IL');

export function dateOrder(value: Scalar | undefined) {
  const text = String(value ?? '');
  const match = /^(\d{4})-?(\d{2})(?:-?(\d{2}))?(?:$|[T ])/.exec(text);
  if (!match) return 0;
  const [, y, m, d = '01'] = match;
  const utc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return utc.getUTCFullYear() === Number(y) &&
    utc.getUTCMonth() + 1 === Number(m) &&
    utc.getUTCDate() === Number(d)
    ? utc.valueOf()
    : 0;
}

export function dateLabel(value: Scalar) {
  const text = String(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(text);
  const compact = /^(\d{4})(\d{2})(\d{2})?$/.exec(text);
  const month = /^(\d{4})[-/](\d{2})$/.exec(text);
  const match = iso ?? compact ?? month;
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return text;
  if (!match[3]) return `${match[2]}/${match[1]}`;
  const calendar = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return calendar.getUTCDate() === Number(match[3])
    ? `${match[3]}/${match[2]}/${match[1]}`
    : text;
}

export function quarter(value: Scalar) {
  const match = /^(\d{4})(0[1-9]|1[0-2])$/.exec(String(value));
  return match
    ? `רבעון ${Math.ceil(Number(match[2]) / 3)}, ${match[1]}`
    : String(value ?? 'לא זמין');
}

export function ownershipDate(value: Scalar) {
  const text = String(value ?? '');
  const month = /^(\d{4})(0[1-9]|1[0-2])$/.exec(text);
  if (!month)
    return text && dateOrder(value) ? dateLabel(value) : 'מועד לא זמין';
  const start = Math.floor((Number(month[2]) - 1) / 3) * 3;
  const months = new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    timeZone: 'UTC',
  });
  const label = (offset: number) =>
    months.format(Date.UTC(Number(month[1]), start + offset));
  return `${label(0)}–${label(2)} ${month[1]}`;
}

export function expiredDays(value: Scalar, now: Date) {
  const text = String(value);
  if (!/^\d{4}(?:-\d{2}-\d{2}|\d{4})(?:$|[T ])/.test(text)) return 0;
  const date = dateOrder(value);
  if (!date) return 0;
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).formatToParts(now);
  const get = (name: string) =>
    Number(parts.find(({ type }) => type === name)?.value);
  return Math.max(
    0,
    (Date.UTC(get('year'), get('month') - 1, get('day')) - date) / 86_400_000,
  );
}

export function displayValue(key: string, value: Scalar) {
  if (value === null) return 'לא זמין';
  const spec = fieldLabels[key];
  if (spec?.format === 'date' || key === 'TAARICH HAFAKAT TAG')
    return dateLabel(value);
  if (spec?.format === 'bool') {
    if (value === true || String(value) === '1') return 'כן';
    if (value === false || String(value) === '0') return 'לא';
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (spec?.format === 'currency') return `₪${number.format(numeric)}`;
    if (spec?.format === 'number') return number.format(numeric);
    if (spec?.max) return `${number.format(numeric)} מתוך ${spec.max}`;
  }
  return String(value);
}
