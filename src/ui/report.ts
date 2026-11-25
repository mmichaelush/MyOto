import { resources, vin, type SourceId } from '../data/sources';
import type { Report, SourceReplies } from '../domain/report';
import {
  sourceDate,
  sourceResult,
  vehicleViewModel,
  type DataRow,
  type DataSection,
  type DataTable,
} from '../presentation/vehicle-view-model';
import { vehicleTimeline } from '../domain/vehicle-timeline';
import { element, link } from './dom';
import { icon, mark } from './icons';
import { renderRecall } from './recall-panel';
import { renderBuyerChecks } from './buyer-checks';
import { localHistoryControl } from './local-history';
import { arrangeReport } from './report-layout';

export { statusLabels, vehicleName } from '../presentation/vehicle-view-model';

function dataRow(data: DataRow, highlight = false) {
  const row = element('div', undefined, highlight ? 'data-metric' : 'data-row');
  row.dataset.field = data.id;
  const label = element('dt', data.label);
  if (data.icon) mark(label, data.icon);
  const value = element('dd');
  value.append(element('bdi', data.text));
  if (data.warning)
    value.append(element('small', data.warning, 'field-warning'));
  if (data.help || data.differences?.length) {
    const details = element('details', undefined, 'field-disclosure');
    const summary = element('summary', undefined, 'with-icon');
    summary.append(
      icon('info'),
      element('span', data.differences ? 'ערכים שונים במקורות' : 'מידע נוסף'),
    );
    details.append(summary);
    if (data.help) details.append(element('p', data.help));
    for (const entry of data.differences ?? []) {
      const observation = element('p');
      observation.append(
        element('bdi', entry.text),
        element('small', entry.source),
      );
      details.append(observation);
    }
    value.append(details);
  }
  row.append(label, value);
  return row;
}

function dataSection(data: DataSection) {
  const section = element('section', undefined, 'data-section');
  section.dataset.sectionId = data.id;
  section.append(mark(element('h3', data.title), data.icon));
  if (data.note) section.append(element('p', data.note, 'muted section-note'));
  for (const group of data.groups) {
    const list = element('dl');
    list.append(...group.map((row) => dataRow(row)));
    section.append(list);
  }
  return section;
}

export function dataTable(data: DataTable) {
  const section = element('section', undefined, 'data-section');
  section.dataset.sectionId = data.id;
  section.append(mark(element('h3', data.title), data.icon));
  if (data.note) section.append(element('p', data.note, 'muted section-note'));
  const scroll = element('div', undefined, 'table-scroll');
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', data.title);
  scroll.tabIndex = 0;
  const table = element('table');
  const head = table.createTHead().insertRow();
  for (const label of data.labels) {
    const column = element('th', label);
    column.scope = 'col';
    head.append(column);
  }
  const body = table.createTBody();
  for (const values of data.rows) {
    const row = body.insertRow();
    values.forEach((value, index) => {
      const cell = row.insertCell();
      cell.append(
        element(
          data.id === 'ownership-history' && index === 3 ? 'strong' : 'bdi',
          value,
        ),
      );
    });
  }
  scroll.append(table);
  section.append(scroll);
  return section;
}

export function sourceDetails(report: Report, checked: SourceReplies = {}) {
  const section = element('details', undefined, 'advanced source-list');
  section.id = 'report-sources';
  section.append(mark(element('summary', 'מקורות המידע'), 'database'));
  const sorted = Object.entries({ ...checked, ...report.sources }).sort(
    ([a], [b]) =>
      resources[a as SourceId].label.localeCompare(
        resources[b as SourceId].label,
        'he',
      ),
  );
  for (const [id, reply] of sorted) {
    const key = id as SourceId;
    if (
      key === 'recall' &&
      !report.identity &&
      !reply.rows.length &&
      !reply.issue
    )
      continue;
    const resource = resources[key];
    const item = element('details', undefined, 'raw-source');
    const match = report.separated.includes(key)
      ? ' · נמצאו פרטי רכב אחר'
      : report.unverified.includes(key)
        ? ' · נמצאו רשומות לפי לוחית, חסר אימות זהות'
        : '';
    const summary = element(
      'summary',
      `${resource.label} · ${sourceResult(reply)}${match}`,
    );
    const update = sourceDate(reply.upstreamUpdatedAt);
    const fetched = sourceDate(reply.fetchedAt);
    const information = element('p', undefined, 'muted');
    if (update || fetched)
      information.append(
        `${update ? 'עודכן ' + update : 'נשלף ' + fetched} · `,
      );
    information.append(link('למאגר הרשמי', resource.url));
    if (report.unverified.includes(key))
      information.append(
        ' · המקור לא סיפק מספיק מזהים תואמים כדי לשייך את הרשומה לרכב הזה.',
      );
    if (key === 'recall' && !reply.rows.length && !reply.issue)
      information.append(
        ' · המאגר כולל הגבלות שנרשמו לאחר שלא בוצע ריקול. אפשר לברר קריאות חדשות מול היבואן.',
      );
    if (reply.httpStatus) information.append(` · HTTP ${reply.httpStatus}`);
    item.append(summary, information);
    item.addEventListener('toggle', () => {
      if (item.open && reply.rows.length && !item.querySelector('pre')) {
        item.append(element('pre', JSON.stringify(reply.rows, null, 2)));
      }
    });
    section.append(item);
  }
  return section;
}

export function renderReport(report: Report, checked?: SourceReplies) {
  const article = element('article', undefined, 'vehicle-report');
  const recall =
    report.complete && report.recalls.length
      ? renderRecall(report, !report.identity, report.identity ? 'h3' : 'h2')
      : undefined;
  if (!report.identity) {
    if (!report.complete) return article;
    article.append(
      element(
        'p',
        report.outcome === 'empty'
          ? 'לא נמצאה רשומת רישוי במספר שהוזן.'
          : 'חלק מהמאגרים לא היו זמינים. אפשר לנסות שוב.',
        'unregistered-note muted',
      ),
      ...(recall ? [recall] : []),
      sourceDetails(report, checked),
    );
    return article;
  }

  const view = vehicleViewModel(report);
  const summary = element('section', undefined, 'report-summary');
  const heading = element('div', undefined, 'vehicle-heading');
  const title = element('div', undefined, 'vehicle-title');
  const name = element('h2');
  name.append(element('bdi', view.title));
  title.append(name);
  if (view.subtitle) title.append(element('p', view.subtitle, 'muted'));
  if (view.status)
    title.append(
      element('p', view.status, `vehicle-status status-${view.statusStyle}`),
    );
  if (recall) {
    const reminder = mark(
      link('רשומת ריקול במאגר ההגבלות', '#vehicle-recall'),
      'triangle-alert',
    );
    reminder.classList.add('recall-reminder');
    title.append(reminder);
  }
  if (report.sources.disabledPermit?.rows.length) {
    const permit = mark(
      element('p', 'הלוחית רשומה במאגר תגי חניה לנכים', 'permit-indicator'),
      'accessibility',
    );
    title.append(permit);
  }
  const plate = element('div', undefined, 'plate report-plate');
  plate.dir = 'ltr';
  plate.append(
    element('span', view.kind === 'equipment' ? 'צמ״ה' : 'IL', 'plate-country'),
    element('bdi', view.plate),
  );
  heading.append(title, plate);
  summary.append(heading);
  if (view.highlights.length) {
    const measures = element('dl', undefined, 'report-metrics');
    measures.append(...view.highlights.map((row) => dataRow(row, true)));
    summary.append(measures);
  }
  const footnote = element(
    'p',
    'הנתונים מבוססים על מאגרי משרד התחבורה',
    'report-source-note muted',
  );
  if (view.updated || view.retrieved)
    footnote.append(
      view.updated ? ' · עודכן ' + view.updated : ' · נשלף ' + view.retrieved,
    );
  summary.append(footnote);
  article.append(summary);
  if (!report.complete) return article;

  if (view.alerts.length) {
    const alerts = element('ul', undefined, 'report-alerts notice');
    for (const text of view.alerts) alerts.append(element('li', text));
    article.append(alerts);
  }
  const sources = sourceDetails(report, checked);
  const registryRow = report.sources.private_cars_1?.rows[0];
  const chassis = registryRow && vin(registryRow);
  if (
    report.identity === 'private_cars_1' &&
    chassis &&
    !report.separated.includes('private_cars_1') &&
    !report.unverified.includes('private_cars_1')
  )
    sources.append(localHistoryControl(report.plate, chassis));
  const details = element('div', undefined, 'report-sections');
  details.id = 'vehicle-details';
  details.append(
    ...view.sections.map(dataSection),
    ...view.additional.map(dataSection),
  );
  const history = view.tables.map(dataTable);
  if (history[0]) history[0].id = 'vehicle-history';
  details.append(...history);
  const nav = element('nav', undefined, 'report-nav');
  nav.setAttribute('aria-label', 'ניווט בתוך הדוח');
  if (details.children.length)
    nav.append(link('מפרט ורישוי', '#vehicle-details'));
  if (history.length) nav.append(link('היסטוריה', '#vehicle-history'));
  const sourceLink = link('מקורות המידע', '#report-sources');
  sourceLink.addEventListener('click', () => {
    sources.open = true;
  });
  nav.append(sourceLink);
  summary.append(nav);
  if (recall) article.append(recall);
  if (details.children.length) article.append(details);
  if (details.children.length > 1) nav.append(arrangeReport(details));
  const chronology = vehicleTimeline(report);
  if (chronology.length > 1) {
    const timeline = element('details', undefined, 'advanced');
    timeline.id = 'vehicle-timeline';
    timeline.append(
      mark(element('summary', 'ציר זמן'), 'calendar-days'),
      dataTable({
        id: 'timeline-events',
        title: 'אירועים מתועדים',
        icon: 'calendar-days',
        labels: ['מועד', 'אירוע או סוג בעלות', 'מקור'],
        rows: chronology,
        note: 'כאשר המקור מוסר רבעון, מוצג טווח החודשים. סדר הרשומות החולקות תקופה אינו קובע את סדר האירועים בפועל.',
      }),
    );
    article.append(timeline);
  }
  const buyer = renderBuyerChecks(report);
  if (buyer) article.append(buyer);
  if (
    view.sections.some((section) =>
      section.groups.some((group) =>
        group.some((row) => row.scope === 'model'),
      ),
    )
  )
    article.append(
      element(
        'p',
        'שדות חסרים במרשם הושלמו ממפרט הדגם הזמין.',
        'muted section-note',
      ),
    );
  article.append(sources);
  return article;
}
