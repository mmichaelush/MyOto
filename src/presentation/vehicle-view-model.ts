import { resources } from '../data/sources';
import type { Reply, Row, Scalar } from '../data/types';
import {
  dateLabel,
  dateOrder,
  displayValue,
  fieldLabels,
  expiredDays,
  ownershipDate,
} from '../domain/format';
import { formatPlate } from '../domain/plate';
import { issueText } from '../domain/diagnostics';
import { fieldPriority, type Observation, type Report } from '../domain/report';
import { fieldIcon } from './field-icons';

export type VehicleKind = 'car' | 'motorcycle' | 'truck' | 'bus' | 'equipment';
export const statusLabels = {
  listed: 'רכב פעיל',
  inactive: 'רישום לא פעיל',
  cancelled: 'הרישום בוטל',
  conflicting: 'מידע סותר על מצב הרישוי',
  unknown: 'מצב הרישוי לא אומת',
};
export function sourceResult(reply: Reply) {
  if (reply.issue) return issueText(reply.issue, reply.httpStatus);
  return reply.rows.length ? 'נמצאו נתונים' : 'לא נמצאה התאמה';
}
const clock = new Intl.DateTimeFormat('he-IL', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Jerusalem',
});
export function sourceDate(value?: string) {
  const ms = value ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? clock.format(ms) : undefined;
}

export const categories = {
  identity: { title: 'פרטי הרכב', icon: 'car-front' },
  registration: { title: 'רישוי ובעלות', icon: 'clipboard-check' },
  engine: { title: 'מנוע ודלק', icon: 'settings' },
  drivetrain: { title: 'גיר והנעה', icon: 'cog' },
  dimensions: { title: 'מידות, משקל וגרירה', icon: 'ruler' },
  wheels: { title: 'צמיגים וחישוקים', icon: 'circle-gauge' },
  safety: { title: 'בטיחות ואבזור', icon: 'shield-check' },
  emissions: { title: 'זיהום וסביבה', icon: 'leaf' },
  equipment: { title: 'נתוני צמ״ה', icon: 'construction' },
  bus: { title: 'תחבורה ציבורית', icon: 'bus-front' },
  truck: { title: 'רכב כבד', icon: 'truck' },
} as const;
type Category = keyof typeof categories;
type DisplayRule = {
  id: string;
  label: string;
  category: Category;
  keys: string[];
  order: number;
  unit?: string;
  icon?: string;
  help?: string;
  kinds?: VehicleKind[];
};
export type DataRow = {
  id: string;
  label: string;
  text: string;
  icon?: string;
  warning?: string;
  help?: string;
  differences?: { source: string; text: string }[];
};
export type DataSection = {
  id: string;
  title: string;
  icon: string;
  groups: DataRow[][];
  note?: string;
};
export type DataTable = {
  id: string;
  title: string;
  icon: string;
  labels: string[];
  rows: string[][];
  note?: string;
};

const categoryMap: Record<string, Category> = {
  'כללי וזיהוי': 'identity',
  'רישוי ובעלות': 'registration',
  'מנוע והנעה': 'engine',
  'מידות ומשקלים': 'dimensions',
  'צמיגים וחישוקים': 'wheels',
  'אבזור ונוחות': 'safety',
  'נתוני צמ"ה ורכב כבד': 'equipment',
  'תחבורה ציבורית וצי רכב': 'bus',
  'בטיחות פסיבית': 'safety',
  'מערכות בטיחות אקטיביות': 'safety',
  'פליטות וסביבה': 'emissions',
};

const rules: Record<string, Partial<DisplayRule>> = {
  tozeret_nm: { order: 10 },
  kinuy_mishari: { label: 'שם מסחרי', order: 20 },
  degem_nm: { label: 'דגם במרשם', order: 30 },
  shnat_yitzur: { order: 40 },
  tzeva_rechev: { order: 50 },
  misgeret: {
    keys: ['misgeret', 'mispar_shilda', 'shilda'],
    label: 'מספר שלדה',
    order: 70,
  },
  tozeret_eretz_nm: {
    keys: ['tozeret_eretz_nm', 'production_country'],
    label: 'ארץ ייצור',
  },
  sug_rechev_EU_cd: {
    label: 'סיווג אירופי (EU)',
    help: 'קטגוריית כלי הרכב כפי שדווחה במקור.',
  },
  tkina_EU: { label: 'תקינה אירופית' },
  tokef_dt: { label: 'תוקף רישוי', order: 10, icon: 'clipboard-check' },
  tokef_date: {
    label: 'תוקף רישום צמ״ה',
    order: 10,
    kinds: ['equipment'],
    icon: 'clipboard-check',
  },
  baalut: { label: 'בעלות רשומה', order: 20, icon: 'users' },
  kilometer_test_aharon: {
    label: 'קריאת נסועה אחרונה',
    order: 30,
    icon: 'gauge',
    unit: 'ק״מ',
    help: 'מאגר ההיסטוריה מספק קריאת נסועה ללא תאריך המדידה. תאריך הטסט מוצג בנפרד לפי מרשם הרישוי.',
  },
  total_kilometer: {
    label: 'קילומטראז׳ מדווח בצי',
    icon: 'gauge',
    unit: 'ק״מ',
    kinds: ['bus'],
  },
  nefach_manoa: {
    keys: ['nefach_manoa', 'nefah_manoa'],
    label: 'נפח מנוע',
    order: 10,
    unit: 'סמ״ק',
  },
  koah_sus: { label: 'הספק מנוע', order: 20, unit: 'כ״ס' },
  sug_delek_nm: { label: 'סוג דלק', order: 30 },
  PropulsionType_nm: { label: 'הנעה לפי נתוני הצי', category: 'drivetrain' },
  automatic_ind: {
    label: 'תיבת הילוכים אוטומטית',
    category: 'drivetrain',
    order: 10,
  },
  ramat_gimur: { category: 'identity', order: 55 },
  shinui_zmig_ind: { category: 'wheels' },
  hanaa_nm: { label: 'תצורת הנעה', category: 'drivetrain', order: 20 },
  grira_nm: {
    label: 'וו גרירה',
    category: 'dimensions',
    kinds: ['car', 'truck'],
  },
  mishkal_kolel: { label: 'משקל כולל', order: 10, unit: 'ק״ג' },
  mishkal_azmi: { label: 'משקל עצמי', order: 20, unit: 'ק״ג' },
  kosher_grira_im_blamim: {
    category: 'dimensions',
    label: 'כושר גרירה עם בלמים',
    unit: 'ק״ג',
    order: 30,
  },
  kosher_grira_bli_blamim: {
    category: 'dimensions',
    label: 'כושר גרירה בלי בלמים',
    unit: 'ק״ג',
    order: 40,
  },
  SeatsNum: {
    label: 'מושבים לפי נתוני הצי',
    category: 'bus',
    order: 30,
    kinds: ['bus'],
  },
  operator_nm: { label: 'מפעיל', order: 10, kinds: ['bus'] },
  sug_tzama_nm: { label: 'סוג ציוד', order: 10, kinds: ['equipment'] },
  shilda_totzar_en_nm: { label: 'יצרן השלדה', kinds: ['equipment'] },
  mishkal_ton: { label: 'משקל הציוד', unit: 'טון', kinds: ['equipment'] },
  kosher_harama_ton: { label: 'כושר הרמה', unit: 'טון', kinds: ['equipment'] },
  hagbala_nm_1: { category: 'truck', kinds: ['truck', 'equipment'] },
  hagbala_nm_2: { category: 'truck', kinds: ['truck', 'equipment'] },
};
const alternateKeys = new Set(
  Object.entries(rules).flatMap(([key, rule]) =>
    (rule.keys ?? []).filter((entry) => entry !== key),
  ),
);
export const fieldSchema: DisplayRule[] = Object.entries(fieldLabels)
  .filter(([key]) => !alternateKeys.has(key))
  .map(([key, spec]) => ({
    id: key,
    keys: [key],
    label: spec.label,
    category: categoryMap[spec.category] ?? 'identity',
    order: 100,
    ...rules[key],
  }))
  .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'he'));

const equipmentTitle = (report: Report) =>
  report.fields.shilda_totzar_en_nm?.chosen.value;
export function vehicleName(report: Report) {
  const { fields } = report;
  return (
    [
      fields.tozeret_nm?.chosen.value ?? equipmentTitle(report),
      (fields.kinuy_mishari ?? fields.degem_nm)?.chosen.value,
      fields.shnat_yitzur?.chosen.value,
    ]
      .filter((value) => value !== undefined && value !== '')
      .join(' ') ||
    (report.domain === 'equipment'
      ? 'ציוד מכני הנדסי'
      : report.identity
        ? resources[report.identity].label
        : 'רכב')
  );
}
export function vehicleKind(report: Report): VehicleKind {
  if (report.domain === 'equipment') return 'equipment';
  if (report.identity === 'twoWheeled') return 'motorcycle';
  const type = String(report.fields.sug_rechev_nm?.chosen.value ?? '');
  if (type.includes('אוטובוס')) return 'bus';
  if (type.includes('אופנוע')) return 'motorcycle';
  if (report.identity === 'heavy' || type.includes('משאית')) return 'truck';
  return 'car';
}
function textFor(key: string, value: Scalar, unit?: string) {
  const formatted = displayValue(key, value);
  if (!unit || !Number.isFinite(Number(value)) || value === null)
    return formatted;
  return `${new Intl.NumberFormat('he-IL').format(Number(value))} ${unit}`;
}

function fieldRow(
  rule: DisplayRule,
  report: Pick<Report, 'fields' | 'identity'>,
  today?: Date,
): DataRow | undefined {
  const { fields, identity } = report;
  const observations = rule.keys.flatMap((key) => {
    const field = fields[key];
    return field ? [field.chosen, ...field.alternatives] : [];
  });
  const first = observations.reduce<Observation | undefined>(
    (preferred, candidate) =>
      !preferred ||
      fieldPriority(rule.id, candidate.source, identity) <
        fieldPriority(rule.id, preferred.source, identity)
        ? candidate
        : preferred,
    undefined,
  );
  if (!first) return;
  const normal = (value: Observation) => {
    const text = String(value.value).trim().replace(/\s+/g, ' ').toUpperCase();
    return rule.id === 'misgeret' ? text.replace(/[\s-]/g, '') : text;
  };
  const chosen = normal(first);
  const seen = new Set<string>();
  const differences = observations
    .filter((observation) => {
      const value = normal(observation);
      const key = observation.source + ':' + value;
      if (value === chosen || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((observation) => ({
      source: resources[observation.source].label,
      text: textFor(rule.id, observation.value, rule.unit),
    }));
  const overdue =
    today && rule.id === 'tokef_dt' && !differences.length
      ? expiredDays(first.value, today)
      : 0;
  return {
    id: rule.id,
    label: rule.label,
    text: textFor(rule.id, first.value, rule.unit),
    icon: rule.icon ?? fieldIcon(rule.id, categories[rule.category].icon),
    warning: overdue
      ? `תוקף הרישיון פג לפני ${overdue === 1 ? 'יום אחד' : new Intl.NumberFormat('he-IL').format(overdue) + ' ימים'}`
      : undefined,
    help: rule.help,
    differences: differences.length
      ? [
          {
            source: resources[first.source].label,
            text: textFor(rule.id, first.value, rule.unit),
          },
          ...differences,
        ]
      : undefined,
  };
}

const defaultOrder = [
  'identity',
  'registration',
  'engine',
  'drivetrain',
  'dimensions',
  'wheels',
  'safety',
  'emissions',
  'bus',
  'truck',
  'equipment',
] as const;
const priority: Partial<Record<VehicleKind, Category[]>> = {
  motorcycle: ['identity', 'registration', 'engine', 'wheels'],
  truck: ['identity', 'registration', 'dimensions', 'truck'],
  bus: ['identity', 'registration', 'bus', 'dimensions'],
  equipment: ['identity', 'equipment', 'registration', 'dimensions'],
};
export const baseSections = (
  report: Report,
  kind = vehicleKind(report),
  today?: Date,
) => {
  const order = [...new Set([...(priority[kind] ?? []), ...defaultOrder])];
  const rows = fieldSchema.flatMap((rule) => {
    if (rule.kinds && !rule.kinds.includes(kind)) return [];
    const row = fieldRow(rule, report, today);
    return row
      ? [
          {
            category:
              rule.category === 'truck' && kind === 'equipment'
                ? 'equipment'
                : rule.category,
            row,
          },
        ]
      : [];
  });
  return order.flatMap((category) => {
    const items = rows
      .filter((item) => item.category === category)
      .map((item) => item.row);
    return items.length
      ? [{ id: category, ...categories[category], groups: [items] }]
      : [];
  });
};

function supplement(
  id: string,
  title: string,
  icon: string,
  rows: Row[],
  map: Record<string, string>,
  allowMapped = false,
): DataSection {
  return {
    id,
    title,
    icon,
    groups: rows
      .map((row) =>
        Object.entries(row).flatMap(([key, value]) => {
          const label =
            map[key] ?? (allowMapped ? fieldLabels[key]?.label : undefined);
          return label && value !== null && value !== ''
            ? [
                {
                  id: key,
                  label,
                  text: displayValue(key, value),
                  icon: fieldIcon(key, icon),
                },
              ]
            : [];
        }),
      )
      .filter((group) => group.length),
  };
}

const supplements = [
  [
    'modelCounts',
    'כמות כלי רכב בדגם ובשנתון',
    'chart-column',
    {
      degem_cd: 'קוד דגם',
      mispar_rechavim_pailim: 'פעילים',
      mispar_rechavim_le_pailim: 'לא פעילים',
    },
    false,
  ],
  [
    'modelDetails',
    'מפרט דגם מהקטלוג',
    'settings',
    {
      degem_cd: 'קוד דגם',
      ramat_gimur: 'גימור',
      delek_nm: 'דלק',
      nefah_manoa: 'נפח מנוע',
    },
    true,
  ],
  [
    'importers',
    'מחיר יבואן לדגם חדש',
    'info',
    { semel_yevuan: 'קוד יבואן', mehir: 'מחיר' },
    true,
  ],
  [
    'disabledPermit',
    'תג חניה לנכה',
    'clipboard-check',
    { 'TAARICH HAFAKAT TAG': 'תאריך הנפקה', 'SUG TAV': 'קוד תג' },
    false,
  ],
  [
    'busFleet',
    'מפרט צי אוטובוסים',
    'bus-front',
    {
      bus_license_id: 'מספר רישוי',
      PropulsionType_nm: 'סוג הנעה',
      SeatsNum: 'מושבים לפי נתוני הצי',
    },
    true,
  ],
  [
    'filters',
    'מסנן פליטות לפי לוחית',
    'leaf',
    { taarich_hatkana: 'תאריך התקנה' },
    true,
  ],
] as const;

export function vehicleViewModel(report: Report, today = new Date()) {
  const kind = vehicleKind(report);
  const highlights: DataRow[] = [];
  for (const id of [
    kind === 'equipment' ? 'tokef_date' : 'tokef_dt',
    'kilometer_test_aharon',
    'baalut',
  ]) {
    const rule = fieldSchema.find((field) => field.id === id);
    const row = rule && fieldRow(rule, report, today);
    if (row) highlights.push(row);
  }
  const alerts: string[] = [];
  if (report.separated.length)
    alerts.push(
      'בחלק מהמקורות מופיעים פרטי רכב אחר באותו מספר. הנתונים נשמרו בנפרד.',
    );
  if (report.unverified.length)
    alerts.push('רישומים שהשיוך שלהם לרכב הזה לא אומת מוצגים בנפרד.');
  if (Object.values(report.sources).some((reply) => reply.issue))
    alerts.push('הדוח חלקי. לפחות מאגר אחד לא היה זמין או מסר מידע חסר.');
  if (report.sources.safetyDiscount?.rows.length)
    alerts.push(
      'הלוחית מופיעה ברשימת כלי הרכב שעשויים לקבל הנחה באגרת הרישוי לאחר התקנת מערכת בטיחות. את הזכאות בפועל בודק משרד התחבורה.',
    );
  if (report.sources.anchors?.rows.length)
    alerts.push('הלוחית מופיעה במאגר חובת התקנת נקודות עיגון.');
  const events = [
    [report.fields.rishum_rishon_dt?.chosen, 'רישום ראשון'],
    [report.fields.mivchan_acharon_dt?.chosen, 'מבחן רישוי אחרון'],
    [
      report.fields.bitul_dt?.chosen ?? report.fields.taarich_bitzul?.chosen,
      'ביטול רישום',
    ],
  ] as const;
  const timeline = events
    .flatMap(([value, label]) => (value ? [{ value, label }] : []))
    .sort((a, b) => dateOrder(b.value.value) - dateOrder(a.value.value));
  const tables: DataTable[] = [];
  // Without trader IDs, count distinct reported periods, not people or businesses.
  const dealerPeriods = new Set(
    report.ownership
      .filter(
        ({ baalut }) =>
          typeof baalut === 'string' && /^סוחר(?:\s|$)/.test(baalut.trim()),
      )
      .map(({ baalut_dt }) =>
        baalut_dt == null ? '' : ownershipDate(baalut_dt),
      )
      .filter((period) => period && period !== 'מועד לא זמין'),
  ).size;
  if (dealerPeriods >= 3)
    alerts.push(
      `ברישומי הלוחית מופיעה בעלות מסוג סוחר ב־${dealerPeriods} תקופות שונות. כדאי לעיין בהיסטוריית הבעלויות ולבקש תיעוד.`,
    );
  if (report.ownership.length)
    tables.push({
      id: 'ownership-history',
      title: 'היסטוריית בעלויות',
      icon: 'users',
      labels: ['מועד', 'סוג בעלות'],
      rows: report.ownership.map((row) => [
        ownershipDate(row.baalut_dt ?? null),
        String(row.baalut ?? 'לא זמין'),
      ]),
      note: `${report.ownership.length} רישומים לפי לוחית. כשהמאגר מוסר תקופה בלבד, מוצג טווח החודשים. השיוך לרכב הנוכחי אינו מאומת.`,
    });
  if (timeline.length)
    tables.push({
      id: 'registration-timeline',
      title: 'מועדים ברישוי',
      icon: 'history',
      labels: ['מועד', 'אירוע'],
      rows: timeline.map(({ value, label }) => [dateLabel(value.value), label]),
    });
  const additional = supplements
    .flatMap(([id, title, icon, map, allowMapped]) => {
      const rows = report.sources[id]?.rows;
      return rows?.length
        ? [supplement(id, title, icon, rows, map, allowMapped)]
        : [];
    })
    .filter((section) => section.groups.length);
  const history = report.sources.history_1?.rows;
  if (history?.length && report.unverified.includes('history_1')) {
    const section = supplement(
      'history-by-plate',
      'נסועה ושינויי מבנה לפי לוחית',
      'gauge',
      history,
      {
        kilometer_test_aharon: 'קריאת נסועה אחרונה',
        rishum_rishon_dt: 'רישום ראשון',
      },
      true,
    );
    if (section.groups.length)
      additional.unshift({
        ...section,
        note: 'המקור משויך ללוחית. ההתאמה לרכב הנוכחי לא אומתה. קריאת הנסועה מופיעה ללא תאריך המדידה.',
      });
  }
  const primary = report.identity ? report.sources[report.identity] : undefined;
  const shown = new Set(highlights.map(({ id }) => id));
  const sections = baseSections(report, kind).flatMap((section) => {
    const groups = section.groups
      .map((group) => group.filter(({ id }) => !shown.has(id)))
      .filter((group) => group.length);
    return groups.length ? [{ ...section, groups }] : [];
  });
  return {
    kind,
    title: vehicleName(report),
    plate: kind === 'equipment' ? report.plate : formatPlate(report.plate),
    subtitle: [
      report.fields.sug_tzama_nm?.chosen.value ??
        report.fields.sug_rechev_nm?.chosen.value,
      report.fields.ramat_gimur?.chosen.value,
    ]
      .filter(Boolean)
      .join(' · '),
    status:
      report.domain === 'registration'
        ? report.statusCoverage === 'pending'
          ? 'בודק מצב רישוי…'
          : statusLabels[report.status]
        : undefined,
    updated: sourceDate(primary?.upstreamUpdatedAt),
    retrieved: sourceDate(primary?.fetchedAt),
    highlights,
    alerts,
    tables,
    sections,
    additional,
  };
}
