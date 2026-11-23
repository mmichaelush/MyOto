import { resources, type SourceId } from '../data/sources';
import type { Reply, Row } from '../data/types';
import {
  dateLabel,
  dateOrder,
  displayValue,
  fieldLabels,
  quarter,
} from '../domain/format';
import { formatPlate } from '../domain/plate';
import type { Report } from '../domain/report';
import { element, link } from './dom';

export const statusLabels = {
  listed: 'מופיע במרשם רישוי פעיל',
  inactive: 'מופיע במאגר רכב לא פעיל',
  cancelled: 'מופיע במאגר ביטול סופי',
  conflicting: 'מקורות הרישוי חלוקים לגבי אותו רכב',
  unknown: 'סטטוס רישוי טרם אומת',
};
const issueLabels = {
  network: 'שגיאת רשת',
  timeout: 'זמן המתנה חלף',
  http: 'שגיאת ספק',
  'invalid-response': 'תגובה לא תקינה',
  schema: 'שינוי בסכמת המקור',
  incomplete: 'נתונים חלקיים',
  budget: 'בדיקה הופסקה בגבול הבקשות',
};
const formatRetrieved = (stamp: string) =>
  new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(stamp));

function state(reply?: Reply) {
  if (!reply) return 'לא נבדק';
  if (reply.issue)
    return (
      issueLabels[reply.issue] +
      (reply.rows.length ? ` · ${reply.rows.length} רשומות התקבלו` : '')
    );
  if (!reply.rows.length) return 'לא נמצאה התאמה במאגר';
  return `${reply.rows.length} רשומות`;
}

export function vehicleName(report: Report) {
  const { fields } = report;
  return (
    [
      fields.tozeret_nm,
      fields.kinuy_mishari ?? fields.degem_nm,
      fields.shnat_yitzur,
    ]
      .flatMap((entry) => (entry ? [entry.chosen.value] : []))
      .join(' ') || resources[report.identity ?? 'cme'].label
  );
}

function plate(report: Report) {
  if (report.domain === 'equipment')
    return element('p', `צמ״ה · ${report.plate}`, 'equipment-number');
  const node = element('div', undefined, 'plate');
  node.dir = 'ltr';
  node.append(
    element('span', 'IL', 'plate-country'),
    element('bdi', formatPlate(report.plate)),
  );
  return node;
}

function pair(title: string, value: string, source?: SourceId, stamp?: string) {
  const row = element('div', undefined, 'datum');
  const definition = element('dd', value);
  if (source) {
    const small = element('small');
    small.append(link(resources[source].label, resources[source].url));
    if (stamp) small.append(element('span', `נשלף ${formatRetrieved(stamp)}`));
    definition.append(small);
  }
  row.append(element('dt', title), definition);
  return row;
}

function rowsTable(headers: string[], rows: string[][]) {
  const scroll = element('div', undefined, 'table-scroll');
  const table = element('table');
  const head = table.createTHead().insertRow();
  for (const title of headers) {
    const column = element('th', title);
    column.scope = 'col';
    head.append(column);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    values.forEach((value) => {
      row.insertCell().textContent = value;
    });
  }
  scroll.append(table);
  return scroll;
}

function sourceDetails(report: Report) {
  const section = element('details', undefined, 'panel advanced');
  section.append(element('summary', 'מקורות ונתונים גולמיים'));
  for (const [id, reply] of Object.entries(report.sources)) {
    const resource = resources[id as SourceId];
    const item = element('details', undefined, 'raw-source');
    const key = id as SourceId;
    const match = report.separated.includes(key)
      ? ' · זהות אחרת נמצאה'
      : report.unverified.includes(key)
        ? ' · התאמת זהות לא אומתה'
        : '';
    const summary = element(
      'summary',
      `${resource.label} · ${state(reply)}${match}`,
    );
    const source = element(
      'p',
      `נשלף ${formatRetrieved(reply.fetchedAt)} · ${reply.durationMs} מילישניות · `,
    );
    source.append(link('עמוד המקור', resource.url));
    item.append(summary, source);
    item.addEventListener('toggle', () => {
      if (item.open && reply.rows.length && !item.querySelector('pre')) {
        item.append(element('pre', JSON.stringify(reply.rows, null, 2)));
      }
    });
    section.append(item);
  }
  return section;
}

function supplementary(
  id: SourceId,
  title: string,
  rows: Row[],
  fields: Record<string, string>,
  includeMappedFields: boolean,
) {
  const section = element('section', undefined, 'panel');
  section.append(
    element('h3', title),
    link(resources[id].label, resources[id].url),
  );
  for (const row of rows) {
    const data = element('dl', undefined, 'grid-data');
    for (const [key, value] of Object.entries(row)) {
      const label =
        fields[key] ??
        (includeMappedFields ? fieldLabels[key]?.label : undefined);
      if (label && value !== null && value !== '')
        data.append(pair(label, displayValue(key, value)));
    }
    if (data.children.length) section.append(data);
  }
  return section;
}

export function renderReport(report: Report) {
  const article = element('article', undefined, 'vehicle-report');
  if (!report.identity) {
    if (!report.complete) return article;
    article.append(
      element(
        'p',
        report.outcome === 'empty'
          ? 'לא נמצאה התאמה למספר במאגרים שנבדקו.'
          : 'חלק מהמאגרים אינם זמינים כרגע. כדאי לנסות שוב.',
        'panel',
      ),
    );
    article.append(sourceDetails(report));
    return article;
  }
  const summary = element('section', undefined, 'panel report-summary');
  const heading = element('div', undefined, 'vehicle-heading');
  const title = element('div', undefined, 'vehicle-title');
  title.append(element('h2', vehicleName(report)));
  const kind =
    report.fields.sug_rechev_nm?.chosen.value ??
    (report.identity === 'cme' ? 'צמ״ה' : undefined);
  const trim = report.fields.ramat_gimur?.chosen.value;
  if (kind || trim)
    title.append(
      element('p', [kind, trim].filter(Boolean).join(' · '), 'muted'),
    );
  heading.append(title, plate(report));
  summary.append(heading);
  if (report.domain === 'registration') {
    const status =
      report.statusCoverage === 'pending'
        ? 'בודק סטטוס רישוי…'
        : statusLabels[report.status];
    summary.append(
      element('p', status, `vehicle-status status-${report.status}`),
    );
  }
  const cards = element('dl', undefined, 'grid-data summary-data');
  for (const [key, label] of [
    ['tokef_dt', 'תוקף רישוי'],
    ['baalut', 'בעלות רשומה'],
    ['kilometer_test_aharon', 'נסועה בטסט האחרון'],
  ]) {
    const observation = report.fields[key]?.chosen;
    cards.append(
      pair(
        label,
        observation
          ? displayValue(key, observation.value)
          : report.complete
            ? 'לא זמין'
            : 'בבדיקה',
        observation?.source,
        observation?.fetchedAt,
      ),
    );
  }
  if (report.domain === 'registration') {
    cards.append(
      pair(
        'ריקול לפי לוחית',
        report.sources.recall
          ? state(report.sources.recall)
          : report.complete
            ? 'לא נבדק'
            : 'בבדיקה',
        'recall',
        report.sources.recall?.fetchedAt,
      ),
      pair(
        'תג חניה לנכה',
        state(report.sources.disabledPermit),
        'disabledPermit',
        report.sources.disabledPermit?.fetchedAt,
      ),
    );
  }
  summary.append(cards);
  const base = report.sources[report.identity];
  if (base)
    summary.append(
      element(
        'p',
        `מרשם משרד התחבורה · נשלף ${formatRetrieved(base.fetchedAt)}`,
        'muted',
      ),
    );
  article.append(summary);

  if (report.separated.length)
    article.append(
      element(
        'p',
        'חלק מרשומות הרישוי מציגות פרטי זיהוי אחרים. אפשר לעיין בהן במקורות.',
        'panel notice',
      ),
    );
  if (Object.values(report.sources).some((reply) => reply.issue))
    article.append(
      element('p', 'הדוח חלקי עקב תקלה במקור אחד או יותר.', 'panel notice'),
    );
  if (!report.complete) return article;

  const timeline = [
    [report.fields.rishum_rishon_dt?.chosen, 'רישום ראשון'],
    [report.fields.mivchan_acharon_dt?.chosen, 'מבחן רישוי אחרון'],
    [report.fields.bitul_dt?.chosen ?? report.fields.taarich_bitzul?.chosen, 'ביטול רישום'],
  ] as const;
  const events = timeline.flatMap(([field, label]) => field ? [{ field, label }] : [])
    .sort((a, b) => dateOrder(b.field.value) - dateOrder(a.field.value));
  if (events.length) {
    const section = element('section', undefined, 'panel');
    section.append(
      element('h3', 'מועדים ברישוי'),
      rowsTable(['מועד', 'אירוע', 'מקור'], events.map(({ field, label }) => [dateLabel(field.value), label, resources[field.source].label])),
    );
    article.append(section);
  }
  if (report.unverified.length)
    article.append(
      element(
        'p',
        'מקורות עם התאמה חלקית זמינים תחת מקורות ונתונים גולמיים.',
        'panel notice',
      ),
    );

  if (report.sources.recall?.rows.length) {
    const notice = element(
      'p',
      'נמצאה התאמה במאגר הריקולים לפי מספר רישוי. ',
      'panel notice',
    );
    notice.append(
      link(
        'בדיקה רשמית והנחיות',
        'https://www.gov.il/he/service/recall-vehicle',
      ),
    );
    article.append(notice);
  }

  if (report.ownership.length) {
    const ownership = element('section', undefined, 'panel');
    ownership.append(
      element('h3', 'היסטוריית בעלויות'),
      element(
        'p',
        `${report.ownership.length} רישומים לפי לוחית, כולל סוחרים. המאגר מדווח ברמת רבעון, והכיסוי עשוי להיות חלקי.`,
        'muted',
      ),
      rowsTable(
        ['מועד', 'סוג בעלות'],
        report.ownership.map((row) => [
          quarter(row.baalut_dt ?? null),
          String(row.baalut ?? 'לא זמין'),
        ]),
      ),
    );
    article.append(ownership);
  }
  const history = report.sources.history_1;
  if (history?.rows.length && report.unverified.includes('history_1')) {
    const context = supplementary(
      'history_1',
      'נתוני טסט ושינויים לפי לוחית',
      history.rows,
      {
        kilometer_test_aharon: 'נסועה בטסט האחרון',
        rishum_rishon_dt: 'רישום ראשון',
      },
      true,
    );
    context.insertBefore(
      element(
        'p',
        'המקור זוהה לפי לוחית בלבד. התאמה לרכב הנוכחי טרם אומתה.',
        'muted',
      ),
      context.children[1] ?? null,
    );
    article.append(context);
  }
  const filters = report.sources.filters;
  if (filters?.rows.length)
    article.append(
      supplementary(
        'filters',
        'מסנן פליטות לפי לוחית',
        filters.rows,
        { taarich_hatkana: 'התקנה' },
        true,
      ),
    );
  if (report.recalls.length) {
    const notices = element('section', undefined, 'panel');
    notices.append(
      element('h3', 'קריאות שירות במאגר ההגבלות'),
      rowsTable(
        ['פתיחה', 'קמפיין', 'תקלה', 'תיאור'],
        report.recalls.map((row) => [
          dateLabel(row.TAARICH_PTICHA ?? 'לא זמין'),
          String(row.RECALL_ID ?? '—'),
          String(row.SUG_TAKALA ?? '—'),
          String(row.TEUR_TAKALA ?? '—'),
        ]),
      ),
    );
    article.append(notices);
  }
  const groups = new Map<string, HTMLElement>();
  for (const [key, spec] of Object.entries(fieldLabels)) {
    const field = report.fields[key];
    if (!field) continue;
    let data = groups.get(spec.category);
    if (!data) {
      data = element('dl', undefined, 'grid-data');
      groups.set(spec.category, data);
      const section = element('section', undefined, 'panel');
      section.append(element('h3', spec.category), data);
      article.append(section);
    }
    const row = pair(
      spec.label,
      displayValue(key, field.chosen.value),
      field.chosen.source,
    );
    if (field.conflicting) {
      const observations = element('details');
      observations.append(element('summary', 'ערכים ממקורות נוספים'));
      for (const alternative of field.alternatives) {
        observations.append(
          element(
            'div',
            `${resources[alternative.source].label} · ${displayValue(key, alternative.value)}`,
          ),
        );
      }
      row.querySelector('dd')?.append(observations);
    }
    data.append(row);
  }
  for (const [id, title, fields] of [
    [
      'modelCounts',
      'ספירות לפי קוד דגם ושנת ייצור',
      {
        degem_cd: 'קוד דגם',
        mispar_rechavim_pailim: 'פעילים',
        mispar_rechavim_le_pailim: 'לא פעילים',
      },
    ],
    [
      'modelDetails',
      'מפרט קטלוג לפי קוד דגם',
      {
        degem_cd: 'קוד דגם',
        ramat_gimur: 'גימור',
        delek_nm: 'דלק',
        nefah_manoa: 'נפח מנוע',
        PropulsionType_nm: 'הנעה',
      },
    ],
    [
      'importers',
      'מחיר יבואן לדגם חדש',
      { semel_yevuan: 'קוד יבואן', mehir: 'מחיר' },
    ],
    [
      'disabledPermit',
      'רישומי תג חניה',
      { 'TAARICH HAFAKAT TAG': 'תאריך הנפקה', 'SUG TAV': 'קוד תג' },
    ],
    [
      'busFleet',
      'נתוני צי אוטובוסים',
      {
        bus_license_id: 'מספר רישוי',
        PropulsionType_nm: 'סוג הנעה',
        SeatsNum: 'מקומות ישיבה',
      },
    ],
    [
      'campaigns',
      'פרטי קמפיין ותיקון',
      {
        RECALL_ID: 'קמפיין',
        OFEN_TIKUN: 'תיקון',
        YEVUAN_TEUR: 'יבואן',
        TELEPHONE: 'טלפון',
        WEBSITE: 'אתר היבואן',
      },
    ],
  ] as const) {
    const reply = report.sources[id];
    if (reply?.rows.length)
      article.append(
        supplementary(
          id,
          title,
          reply.rows,
          fields,
          id === 'modelDetails' || id === 'busFleet' || id === 'importers',
        ),
      );
  }
  if (report.sources.safetyDiscount?.rows.length)
    article.append(
      element(
        'p',
        'נמצאה רשומה במאגר זכאות להתקנת מערכת בטיחות. יש לבדוק את תנאי הזכאות מול משרד התחבורה.',
        'panel notice',
      ),
    );
  if (report.sources.anchors?.rows.length)
    article.append(
      element(
        'p',
        'הרכב מופיע ברשימת חובת התקנת נקודות עיגון.',
        'panel notice',
      ),
    );
  article.append(sourceDetails(report));
  return article;
}
