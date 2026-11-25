export const feeSchedule = {
  effectiveFrom: '2026-04-01',
  year: 2026,
  yearStarts: [2024, 2021, 2017],
  source: 'https://www.gov.il/he/pages/car_fees_2026',
  light: [
    [1266, 1109, 972, 849],
    [1610, 1404, 1230, 1076],
    [1941, 1698, 1487, 1297],
    [2315, 1968, 1674, 1422],
    [2651, 2184, 1802, 1490],
    [3764, 2823, 2117, 1585],
    [5364, 3753, 2627, 1840],
  ],
  motorcycle: [52, 194, 357, 52],
  heavy: [2292, 2877, 3964, 452],
  bus: [656, 1214],
  taxi: [164, 223, 770, 1256],
  tractor: [274, 803],
  collector: 265,
  broadcasting: 135,
  transfer: { motorcycle: 87, motorVehicle: 257, dealer: 43, nonMotor: 87 },
} as const;

export const feeSchedules = {
  '2026': feeSchedule,
  '2025': {
    effectiveFrom: '2025-04-01',
    year: 2025,
    yearStarts: [2023, 2020, 2016],
    source:
      'https://www.gov.il/BlobFolder/policy/car_fees_2025/he/car_fees_2025.pdf',
    light: [
      [1233, 1080, 947, 827],
      [1568, 1368, 1198, 1048],
      [1891, 1654, 1449, 1264],
      [2255, 1918, 1631, 1386],
      [2583, 2128, 1756, 1451],
      [3667, 2750, 2063, 1544],
      [5226, 3657, 2560, 1793],
    ],
    motorcycle: [51, 189, 348, 51],
    heavy: [2233, 2803, 3862, 440],
    bus: [639, 1183],
    taxi: [159, 217, 750, 1224],
    tractor: [266, 783],
    collector: 258,
    broadcasting: 139,
    transfer: { motorcycle: 85, motorVehicle: 250, dealer: 42, nonMotor: 85 },
  },
} as const;

export function effectiveFeeSchedule(now: Date) {
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return Object.values(feeSchedules)
    .filter(({ effectiveFrom }) => effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

type FeeSchedule = (typeof feeSchedules)[keyof typeof feeSchedules];

export const feeVehicleBands = {
  motorcycle: {
    name: 'אופנוע',
    field: 'נפח מנוע או הנעה חשמלית',
    options: ['עד 50 סמ״ק', '51–150 סמ״ק', '151 סמ״ק ומעלה', 'חשמלי'],
  },
  heavy: {
    name: 'מסחרי מעל 3,500 ק״ג',
    field: 'סוג מנוע ומשקל כולל מותר',
    options: [
      'דיזל, עד 16,000 ק״ג',
      'דיזל, 16,001–20,000 ק״ג',
      'דיזל, 20,001 ק״ג ומעלה',
      'מנוע שאינו דיזל',
    ],
  },
  bus: {
    name: 'אוטובוס או טיולית',
    field: 'סוג מנוע באוטובוס',
    options: ['מנוע שאינו דיזל', 'דיזל'],
  },
  taxi: {
    name: 'מונית או רכב סיור ברישיון מתאים',
    field: 'מנוע ומספר מקומות לנוסעים ללא הנהג',
    options: [
      'מנוע שאינו דיזל, עד 4 מקומות',
      'מנוע שאינו דיזל, 5 מקומות ומעלה',
      'דיזל, עד 4 מקומות',
      'דיזל, 5 מקומות ומעלה',
    ],
  },
  tractor: {
    name: 'טרקטור',
    field: 'סוג מנוע בטרקטור',
    options: ['בנזין', 'דיזל או מנוע אחר'],
  },
} as const;

type VehicleBand = keyof typeof feeVehicleBands;

export function hasFeeBands(kind: string): kind is VehicleBand {
  return Object.hasOwn(feeVehicleBands, kind);
}

type VehicleFeeInput =
  | { kind: 'light'; group: number; year: number }
  | { kind: VehicleBand; band: number }
  | { kind: 'collector' };

export function annualBaseFee(
  input: VehicleFeeInput,
  schedule: FeeSchedule = feeSchedule,
): number | undefined {
  switch (input.kind) {
    case 'light': {
      if (
        !Number.isInteger(input.year) ||
        input.year < 1900 ||
        input.year > schedule.year
      )
        return undefined;
      const threshold = schedule.yearStarts.findIndex(
        (start) => input.year >= start,
      );
      const band = threshold < 0 ? schedule.yearStarts.length : threshold;
      return schedule.light[input.group - 1]?.[band];
    }
    case 'motorcycle':
    case 'heavy':
    case 'bus':
    case 'taxi':
    case 'tractor':
      return schedule[input.kind][input.band];
    case 'collector':
      return schedule.collector;
  }
}
