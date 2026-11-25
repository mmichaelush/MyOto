import { VehicleEngine } from '../data/engine';
import { displayValue } from '../domain/format';
import { formatPlate, parsePlate } from '../domain/plate';
import type { Report } from '../domain/report';
import { csvBlob } from './csv';
import { button, element, link } from './dom';
import {
  baseSections,
  categories,
  vehicleName,
  vehicleViewModel,
  type DataRow,
} from '../presentation/vehicle-view-model';
import { dataTable, sourceDetails } from './report';
import { renderRecall } from './recall-panel';
import { mark } from './icons';
import { diagnosticPanel, logFailure, logLookup } from './diagnostics';

const engine = new VehicleEngine();
const form = document.querySelector<HTMLFormElement>('#compare')!;
const result = document.querySelector<HTMLElement>('#comparison')!;
const status = document.querySelector<HTMLElement>('#comparison-status')!;
let active: AbortController | undefined;
const highlights = [
  ['shnat_yitzur', 'שנת ייצור'],
  ['ramat_gimur', 'רמת גימור'],
  ['kilometer_test_aharon', 'קריאת נסועה אחרונה'],
  ['baalut', 'בעלות נוכחית'],
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
  const data = element('dl');
  if (report.identity) {
    for (const [key, title] of highlights) {
      const field = report.fields[key];
      data.append(
        element('dt', title),
        element(
          'dd',
          field ? displayValue(key, field.chosen.value) : 'לא זמין',
        ),
      );
    }
    data.append(
      element('dt', 'סטטוס רישוי'),
      element('dd', vehicleViewModel(report).status ?? '—'),
    );
  }
  if (
    report.sources.recall &&
    (report.identity || report.recalls.length || report.sources.recall.issue)
  )
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
  if (data.childElementCount) card.append(data);
  return card;
}

function comparisonFields(
  report: Report,
  additional: ReturnType<typeof vehicleViewModel>['additional'],
) {
  const fields = new Map<
    string,
    { section: string; title: string; rows: DataRow[] }
  >();
  for (const section of [...baseSections(report), ...additional]) {
    for (const row of section.groups.flat()) {
      const key = `${section.id}/${row.id}`;
      const existing = fields.get(key);
      if (existing) {
        if (!existing.rows.some((value) => value.text === row.text))
          existing.rows.push(row);
      } else
        fields.set(key, {
          section: section.id,
          title: section.title,
          rows: [row],
        });
    }
  }
  return fields;
}

function comparison(reports: Report[], signal: AbortSignal) {
  const cards = element('div', undefined, 'compare-cards');
  reports.forEach((report, index) =>
    cards.append(snapshot(report, index ? 'רכב שני' : 'רכב ראשון')),
  );
  const details = element('section', undefined, 'panel compare-details');
  const tools = element('div', undefined, 'compare-tools');
  const heading = element('h2', 'השוואת מפרט');
  const share = mark(
    button('העתקת קישור להשוואה', async () => {
      try {
        const shared = new URL(location.href);
        shared.searchParams.delete('debug');
        await navigator.clipboard.writeText(shared.href);
        if (!signal.aborted) status.textContent = 'קישור ההשוואה הועתק.';
      } catch (error) {
        if (!signal.aborted) {
          logFailure('copy-comparison', error);
          status.textContent = 'אפשר להעתיק את קישור ההשוואה משורת הכתובת.';
        }
      }
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
  const views = reports.map((report) => vehicleViewModel(report));
  const sides = reports.map((report, index) =>
    comparisonFields(report, views[index].additional),
  );
  const ids = new Set(sides.flatMap((entries) => [...entries.keys()]));
  const csvRows = [
    ['נושא', 'מאפיין', ...reports.map((report) => formatPlate(report.plate))],
  ];
  for (const key of ids) {
    const entries = sides.map((side) => side.get(key)?.rows ?? []);
    const field = sides[0].get(key) ?? sides[1].get(key)!;
    csvRows.push([
      field.title,
      field.rows[0].label,
      ...entries.map(
        (values) =>
          values
            .map((entry) =>
              [
                entry.text,
                entry.scope === 'model' ? 'לפי מפרט הדגם' : '',
                ...(entry.differences ?? []).map(
                  ({ text, source }) => text + ' · ' + source,
                ),
              ]
                .filter(Boolean)
                .join(' · '),
            )
            .join(' | ') || 'לא זמין',
      ),
    ]);
    let group = groups.get(field.section);
    if (!group) {
      group = table.createTBody();
      groups.set(field.section, group);
      const separator = element('th', field.title);
      separator.colSpan = 3;
      separator.scope = 'rowgroup';
      group.insertRow().append(separator);
    }
    const row = group.insertRow();
    const [left, right] = entries.map((values) =>
      values.length === 1 ? values[0] : undefined,
    );
    if (
      left &&
      right &&
      Object.hasOwn(categories, field.section) &&
      !left.scope &&
      !right.scope &&
      !left.differences &&
      !right.differences &&
      normalized(left.text) !== normalized(right.text)
    )
      row.className = 'different';
    const label = element('th');
    label.append(
      mark(element('span', field.rows[0].label), field.rows[0].icon ?? 'info'),
    );
    label.scope = 'row';
    row.append(label);
    for (const values of entries) {
      const cell = row.insertCell();
      if (!values.length) cell.append(element('bdi', 'לא זמין'));
      for (const entry of values) {
        const value = element('div');
        value.append(element('bdi', entry.text));
        if (entry.differences) {
          const alternatives = element('details');
          alternatives.append(element('summary', 'ערכים שונים במקורות'));
          for (const detail of entry.differences)
            alternatives.append(
              element('p', `${detail.text} · ${detail.source}`),
            );
          value.append(alternatives);
        }
        cell.append(value);
      }
    }
  }
  if (
    sides.some((side) =>
      [...side.values()].some(({ rows }) =>
        rows.some(({ scope }) => scope === 'model'),
      ),
    )
  ) {
    const row = table.createTFoot().insertRow();
    const note = row.insertCell();
    note.colSpan = 3;
    note.textContent = 'שדות חסרים במרשם הושלמו ממפרט הדגם הזמין.';
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
  if (ids.size) {
    tools.append(
      mark(
        button('ייצוא השוואה ל־CSV', () => {
          try {
            const url = URL.createObjectURL(csvBlob(csvRows));
            const anchor = link('', url);
            anchor.download = 'myoto-comparison.csv';
            try {
              anchor.click();
            } finally {
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
          } catch (error) {
            logFailure('export-comparison', error);
            status.textContent = 'לא ניתן להוריד את קובץ ההשוואה בדפדפן זה.';
          }
        }),
        'download',
      ),
    );
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
  const context = element('div', undefined, 'compare-cards compare-context');
  for (const [index, report] of reports.entries()) {
    const side = element('section', undefined, 'panel');
    side.append(
      element('h2', `רישומים ומקורות · ${formatPlate(report.plate)}`),
    );
    const view = views[index];
    if (view.alerts.length) {
      const notices = element('ul');
      notices.append(...view.alerts.map((message) => element('li', message)));
      side.append(notices);
    }
    side.append(...view.tables.map(dataTable));
    if (report.recalls.length) {
      const recall = renderRecall(report, false, 'h3');
      recall.removeAttribute('id');
      side.append(recall);
    }
    const sources = sourceDetails(report);
    sources.removeAttribute('id');
    side.append(sources);
    context.append(side);
  }
  result.replaceChildren(cards, details, context);
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
    const debug = url.searchParams.get('debug');
    url.search = new URLSearchParams({ a, b }).toString();
    if (debug === '1') url.searchParams.set('debug', debug);
    try {
      if (url.href !== location.href) history.pushState(null, '', url);
    } catch (error) {
      logFailure('update-comparison-address', error);
    }
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
    comparison(reports, controller.signal);
    const diagnostics = diagnosticPanel('comparison', reports);
    if (diagnostics) result.append(diagnostics);
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
