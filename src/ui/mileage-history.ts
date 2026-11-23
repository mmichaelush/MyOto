import type { Report } from '../domain/report';
import { dateLabel } from '../domain/format';
import {
  previousReading,
  readingFor,
  type MileageReading,
} from '../domain/mileage-history';
import { element } from './dom';
import { mark } from './icons';

export const mileageStorageKey = 'myoto-test-mileage';
const number = new Intl.NumberFormat('he-IL');
type Sample = MileageReading & { key: string };

function savedSamples() {
  const value: unknown = JSON.parse(
    localStorage.getItem(mileageStorageKey) ?? '[]',
  );
  return Array.isArray(value)
    ? value
        .filter(
          (row): row is Sample =>
            row &&
            typeof row.key === 'string' &&
            typeof row.date === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
            Number.isSafeInteger(row.km) &&
            row.km > 0,
        )
        .slice(0, 60)
    : [];
}

export async function mileageAlert(report: Report, signal: AbortSignal) {
  const sample = readingFor(report);
  if (!sample || !globalThis.crypto?.subtle) return;
  try {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(sample.identifier),
    );
    if (signal.aborted) return;
    const key = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const saved = savedSamples();
    const previous = previousReading(
      saved.filter((row) => row.key === key),
      sample.reading,
    );
    const rest = saved.filter(
      (row) => row.key !== key || row.date !== sample.reading.date,
    );
    localStorage.setItem(
      mileageStorageKey,
      JSON.stringify([{ key, ...sample.reading }, ...rest].slice(0, 60)),
    );
    if (!previous || previous.km <= sample.reading.km) return;
    const alert = element('section', undefined, 'mileage-warning notice');
    alert.append(
      mark(element('h3', 'נמדדה ירידה בקילומטראז׳'), 'triangle-alert'),
      element(
        'p',
        `${number.format(previous.km)} ק״מ בטסט מ־${dateLabel(previous.date)} · ${number.format(sample.reading.km)} ק״מ בטסט מ־${dateLabel(sample.reading.date)}. כדאי לבדוק את מסמכי הטסט והטיפולים.`,
      ),
      element('small', 'ההשוואה מבוססת על מדידה קודמת שנשמרה בדפדפן הזה.'),
    );
    return alert;
  } catch {
    // Storage and crypto may be blocked in private or embedded browsing.
    return;
  }
}
