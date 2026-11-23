import { cohorts, fetchedAt } from '../data/cohorts';
import { modelFilter } from '../data/sources';
import type { Report } from '../domain/report';
import { element, link } from './dom';

export function mileageComparison(report: Report): HTMLElement | undefined {
  if (report.identity !== 'private_cars_1') return;
  const base = report.sources.private_cars_1?.rows[0];
  const km = report.fields.kilometer_test_aharon;
  if (!base || !km || km.conflicting || Number(km.chosen.value) <= 0) return;
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
      `קריאה אחרונה לרכב: ${number.format(Number(km.chosen.value))} ק״מ. חציון לפי ${mileage.n} קריאות זמינות במדגם: ${number.format(mileage.median)} ק״מ.`,
    ),
    element(
      'p',
      `המדגם מבוסס על סדר רשומות המאגר. נשלף ב־${fetchedAt.slice(0, 10)}.`,
      'muted',
    ),
    link(
      'המדגם בעמוד השנתון',
      import.meta.env.BASE_URL + 'models/' + path + '/',
    ),
  );
  return view;
}
