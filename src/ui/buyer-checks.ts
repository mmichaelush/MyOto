import { buyerChecks } from '../domain/buyer-checks';
import { dateOrder, displayValue } from '../domain/format';
import type { Report } from '../domain/report';
import { statusLabels } from '../presentation/vehicle-view-model';
import { element, link } from './dom';
import { mark } from './icons';

export function renderBuyerChecks(report: Report) {
  if (!report.identity || report.domain !== 'registration') return;
  const panel = element('details', undefined, 'advanced');
  panel.id = 'buyer-checks';
  panel.append(mark(element('summary', 'לפני קניית הרכב'), 'clipboard-check'));
  const details = element('dl');
  const add = (label: string, value: string) =>
    details.append(element('dt', label), element('dd', value));
  const field = (
    id: string,
    isValid: (value: string | number | boolean) => boolean,
  ) => {
    const observation = report.fields[id];
    if (observation?.conflicting)
      return 'נמצאו ערכים שונים במקורות. בדקו את המסמכים.';
    const value = observation?.chosen.value;
    return value !== undefined && isValid(value)
      ? displayValue(id, value)
      : 'לא זמין בדוח';
  };
  add('מצב רישום', statusLabels[report.status]);
  add(
    'תוקף רישוי רשום',
    field('tokef_dt', (value) => Boolean(dateOrder(value))),
  );
  add(
    'קריאת נסועה אחרונה',
    field(
      'kilometer_test_aharon',
      (value) => /^\d+$/.test(String(value)) && Number(value) > 0,
    ),
  );
  const ownership = report.ownership;
  const priorUse = new Set(
    ownership
      .map(({ baalut }) => String(baalut ?? '').trim())
      .filter((label) => /ליסינג|השכרה|החכר/.test(label)),
  );
  add(
    'בעלות לפי לוחית',
    ownership.length
      ? `${ownership.length} רישומים במקור${priorUse.size ? ' · בין סוגי הבעלות שנצפו: ' + [...priorUse].join(', ') : ''}`
      : 'אין רישומים זמינים בדוח',
  );
  const structure = report.fields.shinui_mivne_ind;
  add(
    'שינוי מבנה',
    structure?.conflicting
      ? 'נמצאו ערכים שונים במקורות.'
      : [1, '1', true].includes(structure?.chosen.value ?? false)
        ? 'קיימת אינדיקציה לשינוי מבנה במקור.'
        : 'יש לבדוק את הרישיון ואת מסמכי הרכב.',
  );
  add(
    'קריאות שירות',
    report.recalls.length
      ? 'נמצאו רישומי קריאת שירות לפי לוחית.'
      : report.sources.recall?.issue
        ? 'הבדיקה במאגר קריאות השירות לא הושלמה.'
        : 'בדקו עדכניות מול השירות הרשמי.',
  );
  panel.append(
    details,
    element(
      'p',
      'קריאת הנסועה אינה משויכת כאן למועד טסט. בדיקות שעבוד, גניבה ומצב מכני דורשות אימות נפרד.',
    ),
  );
  const links = element('ul');
  for (const item of buyerChecks) {
    if (!('link' in item)) continue;
    const li = element('li');
    li.append(link(item.link.label, item.link.url));
    links.append(li);
  }
  panel.append(
    links,
    link('לרשימת הבדיקות המלאה', import.meta.env.BASE_URL + 'buying-guide/'),
  );
  return panel;
}
