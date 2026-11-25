import { modelFilter, resources } from '../data/sources';
import type { Reply, Row, Scalar } from '../data/types';
import {
  dateOrder,
  displayValue,
  fieldLabels,
  expiredDays,
  ownershipDate,
} from '../domain/format';
import { annualBaseFee, effectiveFeeSchedule } from '../domain/licensing-fees';
import { inspectionRates } from '../domain/inspection-fees';
import { formatPlate } from '../domain/plate';
import { issueText } from '../domain/diagnostics';
import { fieldPriority, type Observation, type Report } from '../domain/report';
import { fieldIcon } from './field-icons';

export type VehicleKind = 'car' | 'motorcycle' | 'truck' | 'bus' | 'equipment';
export const statusLabels = {
  listed: 'רכב פעיל',
  inactive: 'רישום לא פעיל',
  cancelled: 'הרכב ירד מהכביש',
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
  market: { title: 'יבוא ומחיר', icon: 'wallet' },
  engine: { title: 'מנוע ודלק', icon: 'settings' },
  drivetrain: { title: 'גיר והנעה', icon: 'cog' },
  dimensions: { title: 'מידות, משקל וגרירה', icon: 'ruler' },
  wheels: { title: 'צמיגים וחישוקים', icon: 'circle-gauge' },
  safety: { title: 'מערכות בטיחות ומיגון', icon: 'shield-check' },
  comfort: { title: 'אבזור ונוחות', icon: 'armchair' },
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
  scope?: 'model';
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
  'אבזור ונוחות': 'comfort',
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
  sug_yevu: { category: 'market', order: 10 },
  shem_yevuan: { category: 'market', order: 20 },
  mehir: { category: 'market', order: 30 },
  horaat_rishum: { category: 'registration', order: 50 },
  sug_tkina_nm: { category: 'registration', order: 60 },
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
    category: 'registration',
    help: 'קטגוריית כלי הרכב כפי שדווחה במקור.',
  },
  tkina_EU: { label: 'תקינה אירופית', category: 'registration' },
  tokef_dt: { label: 'תוקף רישוי', order: 10, icon: 'clipboard-check' },
  tokef_date: {
    label: 'תוקף רישום צמ״ה',
    order: 10,
    kinds: ['equipment'],
    icon: 'clipboard-check',
  },
  baalut: { label: 'בעלות נוכחית', order: 20, icon: 'users' },
  mkoriut_nm: { category: 'registration', order: 21 },
  mivchan_acharon_dt: { label: 'מבחן רישוי אחרון', order: 24 },
  moed_aliya_lakvish: { label: 'עלייה לכביש', order: 25 },
  rishum_rishon_dt: { label: 'רישום ראשון', order: 26 },
  rishum_date: { category: 'registration', order: 27 },
  bitul_dt: {
    keys: ['bitul_dt', 'taarich_bitzul'],
    order: 28,
    icon: 'calendar-days',
  },
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
  koah_sus: {
    keys: ['koah_sus'],
    label: 'הספק מנוע',
    order: 20,
    unit: 'כ״ס',
  },
  hespek: { category: 'engine', label: 'הספק כפי שדווח', order: 21 },
  sug_delek_nm: {
    keys: ['sug_delek_nm', 'delek_nm'],
    label: 'סוג דלק',
    order: 30,
  },
  PropulsionType_nm: { label: 'הנעה לפי נתוני הצי', category: 'drivetrain' },
  automatic_ind: {
    label: 'תיבת הילוכים אוטומטית',
    category: 'drivetrain',
    order: 10,
  },
  ramat_gimur: { category: 'identity', order: 55 },
  matzlemat_reverse_ind: { category: 'safety' },
  shinui_zmig_ind: { category: 'wheels' },
  hanaa_nm: { label: 'תצורת הנעה', category: 'drivetrain', order: 20 },
  technologiat_hanaa_nm: { category: 'drivetrain', order: 30 },
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
    return field
      ? [field.chosen, ...field.alternatives].filter(
          (entry) => rule.id !== 'koah_sus' || Number(entry.value) > 0,
        )
      : [];
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

function catalogRows(report: Report) {
  const base = report.identity && report.sources[report.identity]?.rows[0];
  const key = base && modelFilter(base);
  if (!base || !key) return [];
  const variants = (report.sources.modelDetails?.rows ?? []).filter((row) =>
    Object.entries(key).every(
      ([field, value]) => String(row[field]) === String(value),
    ),
  );
  const trim = String(base.ramat_gimur ?? '')
    .normalize('NFKC')
    .trim()
    .toUpperCase();
  const exact = trim
    ? variants.filter(
        (row) =>
          String(row.ramat_gimur ?? '')
            .normalize('NFKC')
            .trim()
            .toUpperCase() === trim,
      )
    : [];
  return exact.length ? exact : variants;
}

export function licensingFeeParameters(
  report: Report,
  today = new Date(),
): URLSearchParams {
  const parameters = new URLSearchParams();
  if (report.identity !== 'private_cars_1' || report.status === 'conflicting')
    return parameters;

  const registration = report.fields.moed_aliya_lakvish;
  if (
    registration &&
    !registration.conflicting &&
    registration.chosen.source === report.identity
  ) {
    const date = /^((?:19|20)\d{2})-(?:0?[1-9]|1[0-2])$/.exec(
      String(registration.chosen.value),
    );
    if (date && Number(date[1]) <= today.getFullYear())
      parameters.set('year', date[1]);
  }

  const registryGroup = report.fields.kvuzat_agra_cd;
  const group = String(registryGroup?.chosen.value ?? '');
  if (
    registryGroup?.chosen.source === report.identity &&
    !registryGroup.conflicting &&
    /^[1-7]$/.test(group)
  ) {
    parameters.set('group', group);
    return parameters;
  }
  const modelSource = report.sources.modelDetails;
  let reportedGroup = false;
  if (modelSource && !modelSource.issue) {
    const groups = new Set(
      catalogRows(report).map((row) => String(row.kvuzat_agra_cd ?? '')),
    );
    reportedGroup = [...groups].some((value) => /^[1-7]$/.test(value));
    const [group] = groups;
    if (groups.size === 1 && /^[1-7]$/.test(group))
      parameters.set('group', group);
  }
  // The 2026 price brackets apply to models first registered in 2026.
  const schedule = effectiveFeeSchedule(today);
  const importers = report.sources.importers;
  if (
    !parameters.has('group') &&
    !reportedGroup &&
    schedule?.year === 2026 &&
    parameters.get('year') === '2026' &&
    importers &&
    !importers.issue
  ) {
    const thresholds = [117000, 141000, 167000, 188000, 244000, 347000];
    const groups = new Set(
      importers.rows.map(({ mehir }) => {
        if (typeof mehir !== 'number' || !Number.isFinite(mehir) || mehir <= 0)
          return 0;
        const band = thresholds.findIndex((end) => mehir <= end);
        return band < 0 ? 7 : band + 1;
      }),
    );
    const [group] = groups;
    if (groups.size === 1 && group) parameters.set('group', String(group));
  }
  return parameters;
}

export function estimatedLicensingFee(
  report: Report,
  parameters?: URLSearchParams,
  today = new Date(),
) {
  parameters ??= licensingFeeParameters(report, today);
  const schedule = effectiveFeeSchedule(today);
  if (!schedule) return;
  if (['cancelled', 'inactive', 'conflicting'].includes(report.status)) return;
  const field = (key: string) => {
    const observation = report.fields[key];
    return observation?.chosen.source === report.identity &&
      !observation?.conflicting
      ? observation?.chosen.value
      : undefined;
  };
  const fuel = field('sug_delek_nm');
  if (
    report.identity === 'twoWheeled' &&
    /^L[1-5]$/.test(String(field('sug_rechev_EU_cd')))
  ) {
    if (fuel === 'חשמל')
      return annualBaseFee({ kind: 'motorcycle', band: 3 }, schedule);
    const volume = Number(field('nefach_manoa'));
    if (fuel === 'בנזין' && Number.isSafeInteger(volume) && volume > 0)
      return annualBaseFee(
        {
          kind: 'motorcycle',
          band: volume <= 50 ? 0 : volume <= 150 ? 1 : 2,
        },
        schedule,
      );
  }
  if (
    report.identity === 'publicTransport' &&
    /^(?:אוטובוס|טיולית)(?:\s|$)/.test(String(field('sug_rechev_nm'))) &&
    (fuel === 'בנזין' || fuel === 'דיזל')
  )
    return annualBaseFee(
      { kind: 'bus', band: fuel === 'דיזל' ? 1 : 0 },
      schedule,
    );
  const weight = Number(field('mishkal_kolel'));
  if (
    report.identity === 'heavy' &&
    /^N[23]$/.test(String(field('tkina_EU'))) &&
    Number.isSafeInteger(weight) &&
    weight > 3500
  ) {
    if (fuel === 'בנזין')
      return annualBaseFee({ kind: 'heavy', band: 3 }, schedule);
    if (fuel === 'דיזל')
      return annualBaseFee(
        {
          kind: 'heavy',
          band: weight <= 16000 ? 0 : weight <= 20000 ? 1 : 2,
        },
        schedule,
      );
  }
  const base = annualBaseFee(
    {
      kind: 'light',
      group: Number(parameters.get('group')),
      year: Number(parameters.get('year')),
    },
    schedule,
  );
  return base === undefined ? undefined : base + schedule.broadcasting;
}

function catalogField(rule: DisplayRule, variants: Row[]): DataRow | undefined {
  if (
    rule.category === 'registration' ||
    ['misgeret', 'mispar_manoa', 'tzeva_rechev'].includes(rule.id)
  )
    return;
  const readings = variants.map((variant) => {
    const value = rule.keys
      .map((key) => variant[key])
      .find((raw) => raw !== undefined && raw !== null && raw !== '');
    return value === undefined || (rule.id === 'koah_sus' && Number(value) <= 0)
      ? undefined
      : textFor(rule.id, value, rule.unit);
  });
  const values = [
    ...new Set(
      readings.filter((value): value is string => value !== undefined),
    ),
  ];
  if (!values.length) return;
  return {
    id: rule.id,
    label: rule.label,
    text: values.join(' · '),
    icon: rule.icon ?? fieldIcon(rule.id, categories[rule.category].icon),
    scope: 'model',
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
  'comfort',
  'emissions',
  'market',
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
  const variants = catalogRows(report);
  const rows = fieldSchema.flatMap((rule) => {
    if (rule.kinds && !rule.kinds.includes(kind)) return [];
    const row = fieldRow(rule, report, today) ?? catalogField(rule, variants);
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
        Object.entries(row)
          .flatMap(([key, value]) => {
            const label =
              map[key] ?? (allowMapped ? fieldLabels[key]?.label : undefined);
            return label && value !== null && value !== ''
              ? [
                  {
                    id: key,
                    label,
                    text:
                      key === 'SUG TAV'
                        ? ({ '1': 'רגיל', '2': 'כיסא גלגלים' }[String(value)] ??
                          'סוג לא ידוע')
                        : displayValue(key, value),
                    icon: fieldIcon(key, icon),
                  },
                ]
              : [];
          })
          .sort((a, b) => a.label.localeCompare(b.label, 'he')),
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
    { 'TAARICH HAFAKAT TAG': 'תאריך הנפקה', 'SUG TAV': 'סוג תג' },
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
  const params = licensingFeeParameters(report, today);
  const fee = estimatedLicensingFee(report, params, today);
  const schedule = effectiveFeeSchedule(today);
  const group = params.get('group');
  if (fee !== undefined && schedule)
    highlights.push({
      id: 'estimated-fee',
      label: 'אגרת רישוי משוערת',
      text: new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'ILS',
        maximumFractionDigits: 0,
      }).format(fee),
      icon: 'wallet',
      help: `תעריף בתוקף מ־${schedule.effectiveFrom}${group ? ` · קבוצה ${group}` : ''}`,
    });
  const registryValue = (field: string) => {
    const observation = report.fields[field];
    return observation?.chosen.source === report.identity &&
      !observation?.conflicting
      ? observation?.chosen.value
      : undefined;
  };
  const fuel = registryValue('sug_delek_nm') ?? registryValue('delek_nm');
  const weight = Number(registryValue('mishkal_kolel'));
  const vehicleType = String(registryValue('sug_rechev_nm') ?? '');
  const category =
    report.identity === 'private_cars_1' ||
    /^מונית(?:\s|$)|^אוטובוס זעיר(?:\s|$)/.test(vehicleType)
      ? 'light'
      : report.identity === 'publicTransport' &&
          /^אוטובוס(?:\s|$)/.test(vehicleType)
        ? 'heavy'
        : report.identity === 'heavy' &&
            /^N[23]$/.test(String(registryValue('tkina_EU'))) &&
            weight > 3500
          ? weight > 8000
            ? 'heavy'
            : 'light'
          : report.identity === 'twoWheeled' &&
              /^L[1-5]$/.test(String(registryValue('sug_rechev_EU_cd')))
            ? 'motorcycle'
            : undefined;
  const rate =
    fuel &&
    inspectionRates.find(([name]) => name === category)?.[
      fuel === 'חשמל' ? 3 : 2
    ];
  if (
    typeof rate === 'number' &&
    today >= new Date('2026-05-31T21:00:00Z') &&
    !['cancelled', 'inactive', 'conflicting'].includes(report.status)
  )
    highlights.push({
      id: 'inspection-price',
      label: 'מחיר מבחן במכון',
      text: new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'ILS',
      }).format(rate),
      icon: 'calendar-days',
      help: 'תעריף למבחן ראשון, אם נדרש טסט. אגרת הרישוי מחושבת בנפרד.',
    });
  const validity = report.fields.tokef_dt;
  const value = validity?.chosen.value;
  const validityDays =
    value != null &&
    !validity?.conflicting &&
    /^\d{4}(?:-\d{2}-\d{2}|\d{4})(?:$|[T ])/.test(String(value)) &&
    dateOrder(value)
      ? expiredDays(value, today)
      : undefined;
  const statusStyle =
    !['inactive', 'cancelled', 'conflicting'].includes(report.status) &&
    validityDays !== undefined
      ? validityDays > 0
        ? 'expired'
        : 'valid'
      : report.status;
  const alerts: string[] = [];
  if (report.separated.length)
    alerts.push(
      'בחלק מהמקורות מופיעים פרטי רכב אחר באותו מספר. הנתונים נשמרו בנפרד.',
    );
  if (Object.values(report.sources).some((reply) => reply.issue))
    alerts.push('הדוח חלקי. לפחות מאגר אחד לא היה זמין או מסר מידע חסר.');
  if (report.sources.safetyDiscount?.rows.length)
    alerts.push(
      'הלוחית מופיעה ברשימת כלי הרכב שעשויים לקבל הנחה באגרת הרישוי לאחר התקנת מערכת בטיחות. את הזכאות בפועל בודק משרד התחבורה.',
    );
  if (report.sources.anchors?.rows.length)
    alerts.push('הלוחית מופיעה במאגר חובת התקנת נקודות עיגון.');
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
  const owners = report.ownership.filter(
    ({ baalut }) =>
      typeof baalut === 'string' &&
      baalut.trim() &&
      !/^סוחר(?:\s|$)/.test(baalut.trim()),
  );
  if (owners.length && !report.sources.history_2?.issue)
    highlights.push({
      id: 'ownership-count',
      label: 'ידיים רשומות',
      text: String(owners.length),
      icon: 'users',
    });
  const hands = new Map(
    [...owners].reverse().map((row, index) => [row, index + 1]),
  );
  if (report.ownership.length)
    tables.push({
      id: 'ownership-history',
      title: 'היסטוריית בעלויות',
      icon: 'users',
      labels: ['מועד', 'סוג בעלות', 'משך משוער', 'יד'],
      rows: report.ownership.map((row, index) => {
        const start = dateOrder(row.baalut_dt);
        const end = index
          ? dateOrder(report.ownership[index - 1]?.baalut_dt)
          : today.valueOf();
        const from = new Date(start);
        const to = new Date(end);
        const months =
          (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
          to.getUTCMonth() -
          from.getUTCMonth();
        const years = Math.floor(months / 12);
        const remainder = months % 12;
        const duration = [
          years === 1 ? 'שנה' : years > 1 ? `${years} שנים` : '',
          remainder === 1 ? 'חודש' : remainder > 1 ? `${remainder} חודשים` : '',
        ]
          .filter(Boolean)
          .join(remainder > 1 ? ' ו־' : ' ו');
        return [
          ownershipDate(row.baalut_dt ?? null),
          String(row.baalut ?? 'לא זמין'),
          start &&
          end &&
          months > 0 &&
          (index > 0 || report.status === 'listed')
            ? duration
            : '—',
          hands.has(row) ? `יד ${hands.get(row)}` : '',
        ];
      }),
      note: 'לפי מספר רישוי · סוחר לא נספר כיד.',
    });
  const additional = supplements
    .flatMap(([id, title, icon, map, allowMapped]) => {
      const rows = report.sources[id]?.rows;
      return rows?.length
        ? [supplement(id, title, icon, rows, map, allowMapped)]
        : [];
    })
    .filter((section) => section.groups.length);
  const history = report.sources.history_1;
  const mileage = [
    ...new Set(
      (history?.rows ?? [])
        .map(({ kilometer_test_aharon }) => Number(kilometer_test_aharon))
        .filter((value) => Number.isSafeInteger(value) && value > 0),
    ),
  ];
  if (report.identity && mileage.length === 1)
    tables.push({
      id: 'odometer-history',
      title: 'היסטוריית קילומטרים',
      icon: 'gauge',
      labels: ['תאריך', 'קילומטרים', 'הפרש'],
      rows: [['—', new Intl.NumberFormat('he-IL').format(mileage[0]), '—']],
      note: 'קריאה אחרונה לפי מספר רישוי. המאגר אינו מוסר את תאריך הקריאה.',
    });
  const primary = report.identity ? report.sources[report.identity] : undefined;
  const registration = report.fields.moed_aliya_lakvish;
  const registrationMonth = String(registration?.chosen.value ?? '').replace(
    /^(\d{4})-(\d)$/,
    '$1-0$2',
  );
  const [registrationYear, registrationMonthNumber] = registrationMonth
    .split('-')
    .map(Number);
  const nowParts = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Asia/Jerusalem',
  })
    .format(today)
    .split('-')
    .map(Number);
  const age =
    (nowParts[0] - registrationYear) * 12 +
    nowParts[1] -
    registrationMonthNumber;
  const registrationAge =
    registration &&
    !registration.conflicting &&
    registration.chosen.source === report.identity &&
    /^\d{4}-(?:0[1-9]|1[0-2])$/.test(registrationMonth) &&
    age >= 0
      ? [
          Math.floor(age / 12) ? `${Math.floor(age / 12)} שנים` : '',
          age % 12 ? `${age % 12} חודשים` : '',
        ]
          .filter(Boolean)
          .join(' · ') || 'פחות מחודש'
      : undefined;
  const shown = new Set(highlights.map(({ id }) => id));
  const firstOwner = owners.findLast(({ baalut_dt }) => dateOrder(baalut_dt));
  const recallSource = report.sources.recall;
  const registrationRows: DataRow[] = [];
  if (firstOwner && !report.sources.history_2?.issue)
    registrationRows.push({
      id: 'first-ownership',
      label: 'סוג בעלות ראשונה',
      text: String(firstOwner.baalut),
      icon: 'users',
    });
  if (report.domain === 'registration' && recallSource)
    registrationRows.push({
      id: 'recall-status',
      label: 'קריאת שירות (ריקול)',
      text: report.recalls.length
        ? 'נמצאה קריאת ריקול שלא בוצעה'
        : recallSource.issue
          ? 'בדיקת ריקול לא זמינה'
          : 'לא נמצאה קריאת ריקול פתוחה במאגר ההגבלות',
      icon: 'triangle-alert',
    });
  const sections = baseSections(report, kind).flatMap((section) => {
    const groups = section.groups
      .map((group) =>
        group.filter(
          ({ id }) =>
            id === 'tokef_dt' ||
            id === 'tokef_date' ||
            id === 'baalut' ||
            !shown.has(id),
        ),
      )
      .filter((group) => group.length);
    if (section.id === 'registration' && registrationAge && groups[0])
      groups[0].push({
        id: 'vehicle-age',
        label: 'גיל הרכב',
        text: registrationAge,
        icon: 'calendar-days',
      });
    if (section.id === 'registration' && registrationRows.length)
      groups.push(registrationRows);
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
    statusStyle,
    status:
      report.domain !== 'registration'
        ? undefined
        : statusStyle === 'expired'
          ? 'תוקף הרישוי פג'
          : statusStyle === 'valid'
            ? 'רישוי בתוקף'
            : report.statusCoverage === 'pending' && statusStyle === 'unknown'
              ? 'בודק מצב רישוי…'
              : statusLabels[statusStyle],
    updated: sourceDate(primary?.upstreamUpdatedAt),
    retrieved: sourceDate(primary?.fetchedAt),
    highlights,
    alerts,
    tables,
    sections,
    additional,
  };
}
