import {
  feeSchedule,
  feeSchedules,
  feeVehicleBands,
} from '../src/domain/licensing-fees.ts';

const override = process.argv[2];
const today =
  override ??
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const date = new Date(today);
if (
  !/^\d{4}-\d{2}-\d{2}$/.test(today) ||
  !Number.isFinite(date.valueOf()) ||
  date.toISOString().slice(0, 10) !== today
)
  throw new Error('Expected a real audit date in YYYY-MM-DD form.');

for (const [year, schedule] of Object.entries(feeSchedules)) {
  if (
    schedule.effectiveFrom !== year + '-04-01' ||
    schedule.year !== Number(year)
  )
    throw new Error('Fee schedule date and year disagree: ' + year);
  if (
    schedule.light.length !== 7 ||
    schedule.light.some((row) => row.length !== schedule.yearStarts.length + 1)
  )
    throw new Error('Wrong number of groups or year bands: ' + year);
  for (const [kind, { options }] of Object.entries(feeVehicleBands)) {
    if (schedule[kind].length !== options.length)
      throw new Error(
        'Fee bands do not match the calculator for ' + kind + ' in ' + year,
      );
  }
}

const reviewFrom = feeSchedule.year + 1 + '-04-01';
if (today < feeSchedule.effectiveFrom || today >= reviewFrom) {
  process.exitCode = 1;
  console.error(
    'Review the latest Ministry of Transport publication before using the default fee schedule on ' +
      today +
      '.',
  );
} else
  console.log(
    'The default fee schedule covers ' +
      today +
      '. Next review: ' +
      reviewFrom +
      '.',
  );
