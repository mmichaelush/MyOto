import { resources } from '../data/sources';
import type { Report } from '../domain/report';
import { formatPlate } from '../domain/plate';
import { recallView } from '../presentation/recall-view';
import { element, link } from './dom';
import { mark } from './icons';

function webAddress(raw: string) {
  if (!raw) return;
  try {
    const url = new URL(raw.startsWith('www.') ? 'https://' + raw : raw);
    if (
      ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    /* The register can contain plain text rather than a URL. */
  }
}

export function renderRecall(
  report: Report,
  includePlate = false,
  heading: 'h2' | 'h3' = 'h2',
) {
  const view = recallView(report);
  const section = element(
    'section',
    undefined,
    `recall-panel recall-${view.state}`,
  );
  section.id = 'vehicle-recall';
  section.append(
    mark(element(heading, 'קריאות שירות (ריקול)'), 'triangle-alert'),
  );
  const summary =
    view.state === 'found'
      ? view.notices.length === 1
        ? 'נמצאה קריאת שירות במאגר ההגבלות.'
        : `נמצאו ${view.notices.length} קריאות שירות במאגר ההגבלות.`
      : view.state === 'empty'
        ? 'לא נמצאה התאמה במאגר ההגבלות על ריקול.'
        : 'בדיקת מאגר הריקולים לא הושלמה.';
  const description = element('p', undefined, 'recall-summary');
  if (includePlate)
    description.append(element('bdi', formatPlate(report.plate)), ' · ');
  description.append(summary);
  section.append(description);
  if (view.incomplete && view.state === 'found')
    section.append(element('p', 'חלק מתוצאות המאגר אינן זמינות כרגע.'));
  if (view.campaignUnavailable)
    section.append(
      element('p', 'פרטים נוספים על קריאת השירות אינם זמינים כרגע.', 'muted'),
    );
  for (const item of view.notices) {
    const entry = element('div', undefined, 'recall-entry');
    const title = element('div', undefined, 'recall-entry-heading');
    title.append(element(heading === 'h2' ? 'h3' : 'h4', item.title));
    if (item.id || item.opened)
      title.append(
        element(
          'small',
          [
            item.id ? 'קריאה ' + item.id : '',
            item.opened ? 'נפתחה ב־' + item.opened : '',
          ]
            .filter(Boolean)
            .join(' · '),
        ),
      );
    entry.append(title);
    if (item.type) entry.append(element('p', item.type, 'muted'));
    if (item.description) entry.append(element('p', item.description));
    if (item.repair) {
      const repair = element('p');
      repair.append(element('strong', 'אופן התיקון '), item.repair);
      entry.append(repair);
    }
    if (item.importer || item.phone || item.website) {
      const contact = element('div', undefined, 'recall-contact');
      if (item.importer) contact.append(element('strong', item.importer));
      if (item.phone) contact.append(element('bdi', item.phone));
      const url = webAddress(item.website);
      if (url) contact.append(link('אתר היבואן', url));
      entry.append(contact);
    }
    section.append(entry);
  }
  const about = element('details', undefined, 'recall-scope');
  about.append(
    element('summary', 'מה המאגר מכסה?'),
    element(
      'p',
      'המאגר כולל כלי רכב שחלפה יותר מחצי שנה מאז שנשלחה לבעליהם הודעה מהיבואן והתיקון טרם בוצע. קריאות חדשות עשויות להתברר מול היבואן.',
    ),
    link('למאגר הרשמי', resources.recall.url),
  );
  const official = link(
    'בירור קריאת שירות',
    'https://www.gov.il/he/service/recall-vehicle',
  );
  official.className = 'recall-official';
  section.append(about, official);
  return section;
}
