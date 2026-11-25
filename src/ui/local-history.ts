import { dateLabel, dateOrder } from '../domain/format';
import { element } from './dom';

const number = new Intl.NumberFormat('he-IL');
const signed = new Intl.NumberFormat('he-IL', { signDisplay: 'exceptZero' });

function observation(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !dateOrder(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error('Invalid observation date');
  return value;
}

export function localHistoryControl(plate: string, chassis: string) {
  const section = element('details', undefined, 'advanced');
  section.append(element('summary', 'טעינת היסטוריית רכב מקובץ מקומי'));
  const label = element('label', 'קובץ תצפיות JSON ');
  const input = element('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  label.append(input);
  const status = element('p');
  status.setAttribute('role', 'status');
  const output = element('div');
  section.append(label, status, output);
  let selection = 0;

  function table(title: string, headers: string[]) {
    const heading = element('h3', title);
    const scroll = element('div', undefined, 'table-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', title);
    const table = element('table');
    const head = table.createTHead().insertRow();
    for (const header of headers) {
      const cell = element('th', header);
      cell.scope = 'col';
      head.append(cell);
    }
    scroll.append(table);
    output.append(heading, scroll);
    return table.createTBody();
  }

  input.addEventListener('change', async () => {
    const current = ++selection;
    const file = input.files?.[0];
    output.replaceChildren();
    status.textContent = '';
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error('Snapshot export too large');
      const data: {
        schema?: unknown;
        plate?: unknown;
        vehicleKey?: unknown;
        readings?: unknown;
        engineChanges?: unknown;
      } | null = JSON.parse(await file.text());
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(chassis),
      );
      const vehicleKey = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      if (current !== selection) return;
      if (
        data?.schema !== 1 ||
        data.plate !== Number(plate) ||
        data.vehicleKey !== vehicleKey
      ) {
        status.textContent = 'הקובץ אינו מתאים ללוחית ולשלדה של הרכב בדוח.';
        return;
      }
      if (!Array.isArray(data.readings) || !Array.isArray(data.engineChanges))
        throw new Error('Invalid observation export');
      const readings = data.readings
        .map((row) => {
          if (
            !Number.isSafeInteger(row?.kilometers) ||
            row.kilometers <= 0 ||
            row.kilometers > 2_000_000
          )
            throw new Error('Invalid mileage reading');
          return {
            at: observation(row.observedAt),
            testDate:
              typeof row.testDate === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(row.testDate) &&
              dateOrder(row.testDate)
                ? dateLabel(row.testDate)
                : '—',
            km: row.kilometers as number,
          };
        })
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      if (
        readings.some(
          (row, index) =>
            index && Date.parse(row.at) === Date.parse(readings[index - 1].at),
        )
      )
        throw new Error('Duplicate observation date');

      const changes = data.engineChanges.map((change) => {
        const from = observation(change.from);
        const to = observation(change.to);
        if (Date.parse(from) >= Date.parse(to))
          throw new Error('Invalid engine observation interval');
        const model = (value: unknown) =>
          typeof value === 'string' ? value.slice(0, 80) : '—';
        return [
          dateLabel(from),
          dateLabel(to),
          model(change.previousModel),
          model(change.currentModel),
        ];
      });

      if (readings.length) {
        const body = table('היסטוריית קילומטרים מקומית', [
          'מועד תצפית',
          'טסט אחרון במרשם',
          'קילומטרים',
          'הפרש',
        ]);
        for (const [index, data] of readings.entries()) {
          const row = body.insertRow();
          const previous = readings[index - 1];
          const difference = previous ? data.km - previous.km : undefined;
          for (const value of [
            dateLabel(data.at),
            data.testDate,
            number.format(data.km),
          ])
            row.insertCell().append(element('bdi', value));
          const cell = row.insertCell();
          cell.append(
            element(
              'bdi',
              difference === undefined ? '—' : signed.format(difference),
            ),
          );
          if (difference !== undefined && difference < 0) {
            row.classList.add('different');
            cell.append(' · ירידה');
          }
        }
      }
      if (changes.length) {
        const body = table('שינויים במספר מנוע', [
          'מתצפית',
          'עד תצפית',
          'קוד קודם',
          'קוד אחרון',
        ]);
        for (const change of changes) {
          const row = body.insertRow();
          for (const value of change)
            row.insertCell().append(element('bdi', value));
        }
      }
      status.textContent =
        readings.length || changes.length
          ? 'נטענו תצפיות מהקובץ המקומי.'
          : 'אין בקובץ קריאות נסועה או שינויי מנוע.';
    } catch {
      if (current === selection)
        status.textContent = 'לא ניתן לקרוא את קובץ התצפיות.';
    }
  });
  return section;
}
