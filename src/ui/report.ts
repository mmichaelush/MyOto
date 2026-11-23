import { resources, type SourceId } from '../data/sources';
import type { Reply, Row } from '../data/types';
import {
  dateLabel,
  displayValue,
  fieldLabels,
  quarter,
} from '../domain/format';
import { formatPlate } from '../domain/plate';
import type { Report } from '../domain/report';
import { element, link } from './dom';

const statusLabels = {
  listed: 'מופיע במרשם רישוי פעיל',
  inactive: 'מופיע במאגר רכב לא פעיל',
  cancelled: 'מופיע במאגר ביטול סופי',
  conflicting: 'נמצאו רשומות רישוי וסטטוס חופפות',
  unknown: 'סטטוס רישוי לא זמין',
};
const issueLabels = {
  network: 'שגיאת רשת',
  timeout: 'זמן המתנה חלף',
  http: 'שגיאת ספק',
  'invalid-response': 'תגובה לא תקינה',
  schema: 'שינוי בסכמת המקור',
  incomplete: 'נתונים חלקיים',
};
const formatRetrieved = (stamp: string) =>
  new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(stamp));

function state(reply?: Reply) {
  if (!reply) return 'לא נבדק';
  if (reply.issue) return issueLabels[reply.issue];
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

function pair(title: string, value: string, source?: SourceId) {
  const row = element('div', undefined, 'datum');
  const definition = element('dd', value);
  if (source) {
    const small = element('small');
    small.append(link(resources[source].label, resources[source].url));
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
    const summary = element('summary', `${resource.label} · ${state(reply)}`);
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
  summary.append(plate(report), element('h2', vehicleName(report)));
  const kind =
    report.fields.sug_rechev_nm?.chosen.value ??
    (report.identity === 'cme' ? 'צמ״ה' : undefined);
  const trim = report.fields.ramat_gimur?.chosen.value;
  if (kind || trim)
    summary.append(element('p', [kind, trim].filter(Boolean).join(' · ')));
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
        observation ? displayValue(key, observation.value) : 'לא זמין',
        observation?.source,
      ),
    );
  }
  if (report.domain === 'registration') {
    cards.append(
      pair('סטטוס רישוי', statusLabels[report.status]),
      pair('ריקול לפי לוחית', state(report.sources.recall), 'recall'),
      pair(
        'תג חניה לנכה',
        state(report.sources.disabledPermit),
        'disabledPermit',
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

  if (report.ownership.length) {
    const ownership = element('section', undefined, 'panel');
    ownership.append(
      element('h3', 'היסטוריית בעלויות'),
      element(
        'p',
        `${report.ownership.filter((row) => row.baalut && row.baalut !== 'סוחר').length} רישומי בעלות במדגם הזמין, למעט רישומי סוחר. מועד הבעלות מעוגל לרבעון.`,
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
