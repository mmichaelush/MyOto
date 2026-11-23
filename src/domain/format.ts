import labels from './labels.json' with { type: 'json' };
import type { Scalar } from '../data/types';

export const fieldLabels: Record<
  string,
  { label: string; category: string; format?: string; max?: number }
> = labels;
const number = new Intl.NumberFormat('he-IL');

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
