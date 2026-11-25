import { cohorts, fetchedAt } from '../data/cohorts';
import { mileagePercentileRange } from '../domain/statistics';
import { modelFilter } from '../data/sources';
import type { Report } from '../domain/report';
import { element, link } from './dom';

export function mileageComparison(report: Report): HTMLElement | undefined {
  if (report.identity !== 'private_cars_1') return;
  const base = report.sources.private_cars_1?.rows[0];
  const km = report.fields.kilometer_test_aharon;
  const reading = Number(km?.chosen.value);
  if (
    !base ||
    !km ||
    km.conflicting ||
    !Number.isSafeInteger(reading) ||
    reading <= 0
  )
    return;
  const key = modelFilter(base);
  if (!key) return;
  const id = [
    key.sug_degem,
    key.tozeret_cd,
    key.degem_cd,
    key.shnat_yitzur,
  ].join('/');
  const match = Object.entries(cohorts).find(([, cohort]) =>
    cohort?.variantKeys.includes(id),
  );
  const mileage = match?.[1]?.mileage;
  if (!match || !mileage) return;
  const [path] = match;
  const number = new Intl.NumberFormat('he-IL');
  const view = element('section', undefined, 'panel');
  view.append(
    element('h3', 'נסועה בהשוואה למדגם השנתון'),
    element(
      'p',
      `קריאה אחרונה לרכב: ${number.format(reading)} ק״מ. חציון לפי ${mileage.n} קריאות זמינות במדגם: ${number.format(mileage.median)} ק״מ.`,
    ),
    element(
      'p',
      `המדגם מפוזר על מקטעים בסדר הלוחיות. נשלף ב־${(match[1]?.fetchedAt ?? fetchedAt).slice(0, 10)}.`,
      'muted',
    ),
    element(
      'p',
      `המחצית האמצעית של הקריאות במדגם נעה בין ${number.format(mileage.p25)} ל־${number.format(mileage.p75)} ק״מ.`,
    ),
    link(
      'המדגם בעמוד השנתון',
      import.meta.env.BASE_URL + 'models/' + path + '/',
    ),
  );
  if (mileage.bands?.length) {
    const [low, high] = mileagePercentileRange(
      reading,
      mileage.bands,
      mileage.n,
    );
    const interval = low === high ? `אחוזון ${low}` : `אחוזונים ${low}–${high}`;
    view.insertBefore(
      element('p', `מיקום משוער במדגם לפי קבוצות נסועה: ${interval}.`),
      view.lastChild,
    );
  }
  return view;
}
