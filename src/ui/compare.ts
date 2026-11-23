import { VehicleEngine } from '../data/engine';
import { displayValue } from '../domain/format';
import { formatPlate, parsePlate } from '../domain/plate';
import type { Report } from '../domain/report';
import { button, element, link } from './dom';
import {
  baseSections,
  statusLabels,
  vehicleName,
  type DataRow,
} from '../presentation/vehicle-view-model';
import { mark } from './icons';
import { logFailure, logLookup } from './diagnostics';

const engine = new VehicleEngine();
const form = document.querySelector<HTMLFormElement>('#compare')!;
const result = document.querySelector<HTMLElement>('#comparison')!;
const status = document.querySelector<HTMLElement>('#comparison-status')!;
let active: AbortController | undefined;
const highlights = [
  ['shnat_yitzur', 'שנת ייצור'],
  ['ramat_gimur', 'רמת גימור'],
  ['kilometer_test_aharon', 'קריאת נסועה אחרונה'],
  ['baalut', 'בעלות רשומה'],
  ['tokef_dt', 'תוקף רישיון'],
];

function reportLink(report: Report) {
  const url = new URL(import.meta.env.BASE_URL, location.origin);
  url.searchParams.set('search', report.plate);
  url.searchParams.set('type', report.domain);
  return link(formatPlate(report.plate), url.href);
}

function normalized(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function snapshot(report: Report, side: string) {
  const card = element('section', undefined, 'panel compare-card');
  const plate = reportLink(report);
  plate.className = 'compare-plate';
  card.append(
    element('p', side, 'muted'),
    plate,
    element(
      'h2',
      report.identity
        ? vehicleName(report)
        : report.outcome === 'partial'
          ? 'תוצאה חלקית'
          : 'רכב לא נמצא',
    ),
  );
  if (!report.identity) return card;
  const data = element('dl');
  for (const [key, title] of highlights) {
    const field = report.fields[key];
    data.append(
      element('dt', title),
      element('dd', field ? displayValue(key, field.chosen.value) : 'לא זמין'),
    );
  }
  data.append(
    element('dt', 'סטטוס רישוי'),
    element('dd', statusLabels[report.status]),
  );
  if (report.sources.recall)
    data.append(
      element('dt', 'מאגר הגבלות ריקול'),
      element(
        'dd',
        report.recalls.length
          ? 'נמצאה רשומה'
          : report.sources.recall.issue
            ? 'הבדיקה לא הושלמה'
            : 'לא נמצאה התאמה',
      ),
    );
  card.append(data);
  return card;
}

function comparison(reports: Report[]) {
  const cards = element('div', undefined, 'compare-cards');
  reports.forEach((report, index) =>
    cards.append(snapshot(report, index ? 'רכב שני' : 'רכב ראשון')),
  );
  const details = element('section', undefined, 'panel compare-details');
  const tools = element('div', undefined, 'compare-tools');
  const heading = element('h2', 'השוואת מפרט');
  const share = mark(
    button('העתקת קישור להשוואה', () => {
      void navigator.clipboard
        .writeText(location.href)
        .then(() => {
          status.textContent = 'קישור ההשוואה הועתק.';
        })
        .catch(() => {
          status.textContent = 'אפשר להעתיק את קישור ההשוואה משורת הכתובת.';
        });
    }),
    'share-2',
  );
  tools.append(heading, share);
  const table = element('table');
  const header = table.createTHead().insertRow();
  header.append(element('th', 'מאפיין'));
  for (const report of reports) {
    const column = element('th');
    column.append(reportLink(report));
    header.append(column);
  }
  for (const column of header.cells) column.scope = 'col';
  const groups = new Map<string, HTMLTableSectionElement>();
  const sides = reports.map(
    (report) =>
      new Map(
        baseSections(report).flatMap((section) =>
          section.groups
            .flat()
            .map((row) => [row.id, { section: section.title, row }] as const),
        ),
      ),
  );
  const ids = new Set(sides.flatMap((entries) => [...entries.keys()]));
  for (const key of ids) {
    const entries: (DataRow | undefined)[] = sides.map(
      (side) => side.get(key)?.row,
    );
    const field = sides[0].get(key) ?? sides[1].get(key)!;
    let group = groups.get(field.section);
    if (!group) {
      group = table.createTBody();
      groups.set(field.section, group);
      const separator = element('th', field.section);
      separator.colSpan = 3;
      separator.scope = 'rowgroup';
      group.insertRow().append(separator);
    }
    const row = group.insertRow();
    const [left, right] = entries;
    if (
      left &&
      right &&
      !left.differences &&
      !right.differences &&
      normalized(left.text) !== normalized(right.text)
    )
      row.className = 'different';
    const label = element('th', field.row.label);
    label.scope = 'row';
    row.append(label);
    for (const entry of entries) {
      const cell = row.insertCell();
      cell.append(element('bdi', entry ? entry.text : 'לא זמין'));
      if (entry?.differences)
        cell.append(element('small', 'ערכים שונים במקורות'));
    }
  }
  const differenceCount = table.querySelectorAll('tr.different').length;
  const summary = element(
    'p',
    differenceCount
      ? `${differenceCount} הבדלים מאומתים`
      : 'לא נמצאו הבדלים מאומתים בשדות הזמינים להשוואה.',
    'muted',
  );
  if (differenceCount) {
    const toggle = button('הבדלים בלבד', () => {
      const filtered = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(filtered));
      for (const group of table.tBodies) {
        const rows = [...group.rows].slice(1);
        group.hidden =
          filtered && !rows.some((row) => row.classList.contains('different'));
        for (const row of rows)
          row.hidden = filtered && !row.classList.contains('different');
      }
    });
    toggle.setAttribute('aria-pressed', 'false');
    tools.append(toggle);
  }
  const scroll = element('div', undefined, 'table-scroll');
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'נתוני השוואה');
  scroll.tabIndex = 0;
  scroll.append(table);
  details.append(
    tools,
    summary,
    groups.size ? scroll : element('p', 'טרם נמצאו שדות להשוואה.'),
  );
  result.replaceChildren(cards, details);
}

function fill(restore = false) {
  const query = new URLSearchParams(location.search);
  for (const key of ['a', 'b']) {
    const field = form.elements.namedItem(key) as HTMLInputElement;
    if (restore || !field.value) field.value = query.get(key) ?? '';
  }
}

async function compare(updateUrl: boolean) {
  active?.abort();
  result.hidden = true;
  const values = new FormData(form);
  const a = parsePlate(String(values.get('a') ?? ''));
  const b = parsePlate(String(values.get('b') ?? ''));
  if (!a || !b) {
    status.textContent = updateUrl ? 'הזינו שני מספרי רישוי תקינים.' : '';
    return;
  }
  if (a === b) {
    status.textContent = 'הזינו שני מספרי רישוי שונים להשוואה.';
    return;
  }
  if (updateUrl) {
    const url = new URL(location.href);
    url.search = new URLSearchParams({ a, b }).toString();
    if (url.href !== location.href) history.pushState(null, '', url);
  }
  const controller = new AbortController();
  active = controller;
  status.textContent = 'בודק את שני כלי הרכב…';
  try {
    const reports = await Promise.all(
      [a, b].map((plate) => engine.comparison(plate, controller.signal)),
    );
    if (controller.signal.aborted) return;
    logLookup('comparison', reports);
    comparison(reports);
    result.hidden = false;
    status.textContent = Object.values(reports).some((report) =>
      Object.values(report.sources).some((source) => source.issue),
    )
      ? 'ההשוואה כוללת מידע חלקי ממקורות זמינים.'
      : 'הבדיקה הסתיימה.';
  } catch (error) {
    if (!controller.signal.aborted) {
      logFailure('comparison', error);
      status.textContent = 'ההשוואה נכשלה. אפשר לנסות שוב.';
    }
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void compare(true);
});
addEventListener('popstate', () => {
  fill(true);
  void compare(false);
});
fill();
void compare(false);
