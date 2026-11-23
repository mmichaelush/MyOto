import { VehicleEngine } from '../data/engine';
import { displayValue } from '../domain/format';
import { formatPlate, parsePlate, type SearchDomain } from '../domain/plate';
import type { Report, SourceReplies } from '../domain/report';
import { button, element, link } from './dom';
import { renderReport, sourceDetails, vehicleName } from './report';
import { renderRecall } from './recall-panel';
import { mark } from './icons';

const form = document.querySelector<HTMLFormElement>('#vehicle-form')!;
const input = document.querySelector<HTMLInputElement>('#plate')!;
const message = document.querySelector<HTMLElement>('#search-status')!;
const output = document.querySelector<HTMLElement>('#report')!;
const actions = document.querySelector<HTMLElement>('#actions')!;
const saved = document.querySelector<HTMLElement>('#saved')!;
const engine = new VehicleEngine();
const lookup = form.closest('.lookup-hero')!;
let controller: AbortController | undefined;
let displayedQuery: string | undefined;

type Saved = { plate: string; domain: SearchDomain };
type SearchMode = SearchDomain | 'auto';
function read(key: string): Saved[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(data)
      ? data
          .filter(
            (item): item is Saved =>
              item &&
              typeof item.plate === 'string' &&
              parsePlate(item.plate) === item.plate &&
              (item.domain === 'registration' || item.domain === 'equipment'),
          )
          .slice(0, 12)
      : [];
  } catch {
    return [];
  }
}

function write(key: string, values: Saved[]) {
  try {
    localStorage.setItem(key, JSON.stringify(values.slice(0, 12)));
    return true;
  } catch {
    return false;
  }
}

function same(a: Saved, b: Saved) {
  return a.plate === b.plate && a.domain === b.domain;
}

function address(entry: { plate: string; domain: SearchMode }) {
  const url = new URL(import.meta.env.BASE_URL, location.origin);
  url.searchParams.set('search', entry.plate);
  if (entry.domain !== 'auto') url.searchParams.set('type', entry.domain);
  return url;
}

function renderSaved() {
  saved.replaceChildren();
  for (const [key, heading] of [
    ['myoto-recent', 'חיפושים אחרונים'],
    ['myoto-favorites', 'מועדפים'],
  ]) {
    const items = read(key);
    if (!items.length) continue;
    const section = element('section');
    const title = element('div', undefined, 'saved-heading');
    title.append(
      element('h2', heading),
      button('ניקוי ' + heading, () => {
        if (write(key, [])) renderSaved();
      }),
    );
    const list = element('ul', undefined, 'saved-items');
    for (const item of items) {
      const row = element('li');
      row.append(
        link(
          item.domain === 'equipment'
            ? `צמ״ה ${item.plate}`
            : formatPlate(item.plate),
          address(item).href,
        ),
      );
      list.append(row);
    }
    section.append(title, list);
    saved.append(section);
  }
  saved.hidden = !saved.children.length;
}

function download(filename: string, content: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }),
  );
  const anchor = link('', url);
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderActions(report: Report) {
  const url = address(report);
  const signal = controller?.signal;
  const actionFeedback = (content: string) => {
    if (!signal?.aborted && actions.isConnected) {
      message.classList.remove('visually-hidden');
      message.textContent = content;
    }
  };
  const summary = [
    vehicleName(report),
    report.plate,
    ...['tokef_dt', 'baalut', 'kilometer_test_aharon'].flatMap((key) => {
      const field = report.fields[key];
      return field ? [displayValue(key, field.chosen.value)] : [];
    }),
  ].join(' · ');
  const copy = async (value: string, success: string) => {
    try {
      await navigator.clipboard.writeText(value);
      actionFeedback(success);
    } catch {
      actionFeedback('ההעתקה לא זמינה בדפדפן זה. אפשר להעתיק משורת הכתובת.');
    }
  };
  const action = (label: string, icon: string, click: () => void) =>
    mark(button(label, click), icon);
  const share = action('שיתוף קישור', 'share-2', () => {
    if (navigator.share && window.self === window.top) {
      void navigator
        .share({ title: vehicleName(report), url: url.href })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException) || error.name !== 'AbortError')
            void copy(url.href, 'הקישור הועתק.');
        });
    } else void copy(url.href, 'הקישור הועתק.');
  });
  const save = action('מועדף', 'star', () => {
    const items = read('myoto-favorites');
    const present = items.some((item) => same(item, report));
    const next = present
      ? items.filter((item) => !same(item, report))
      : [{ plate: report.plate, domain: report.domain }, ...items];
    if (write('myoto-favorites', next)) {
      save.setAttribute('aria-pressed', String(!present));
      renderSaved();
    }
  });
  save.setAttribute(
    'aria-pressed',
    String(read('myoto-favorites').some((item) => same(item, report))),
  );
  const more = element('details', undefined, 'report-more');
  more.append(mark(element('summary', 'עוד פעולות'), 'ellipsis'));
  const menu = element('div', undefined, 'report-action-list');
  menu.append(
    save,
    action('העתקת תקציר', 'copy', () => {
      void copy(summary, 'תקציר הדוח הועתק.');
    }),
    action('דוח קומפקטי', 'printer', () => {
      document.body.classList.add('compact-print');
      try {
        window.print();
      } finally {
        document.body.classList.remove('compact-print');
      }
    }),
    action('תמונה PNG', 'image', () => {
      const article = output.querySelector<HTMLElement>('.vehicle-report');
      if (!article) return;
      const scale = Math.min(
        1,
        8192 / article.scrollHeight,
        Math.sqrt(8_000_000 / (article.scrollWidth * article.scrollHeight)),
      );
      if (scale < 0.45) {
        actionFeedback('הדוח ארוך מדי לתמונה קריאה. אפשר לשמור אותו כ־PDF.');
        return;
      }
      void import('html2canvas')
        .then(({ default: render }) =>
          render(article, {
            scale,
            ignoreElements: (node) =>
              node.id === 'actions' || node.classList.contains('advanced'),
          }),
        )
        .then((canvas) =>
          canvas.toBlob((blob) => {
            if (!blob)
              return actionFeedback('הדפדפן לא הצליח ליצור את קובץ התמונה.');
            const objectUrl = URL.createObjectURL(blob);
            const anchor = link('', objectUrl);
            anchor.download = `car-${report.plate}.png`;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
          }),
        )
        .catch(() => {
          actionFeedback('יצירת התמונה נכשלה. אפשר לשמור את הדוח כ־PDF.');
        });
    }),
    action('JSON', 'file-json', () => {
      const { sources, ...data } = report;
      const sourceStatus = Object.fromEntries(
        Object.entries(sources).map(([id, { fetchedAt, issue, rows }]) => [
          id,
          { fetchedAt, issue, count: rows.length },
        ]),
      );
      download(`car-${report.plate}.json`, {
        ...data,
        sourceStatus,
        schema: 2,
      });
    }),
    action('תגובות מקור', 'download', () =>
      download(`car-${report.plate}-sources.json`, report.sources),
    ),
  );
  more.append(menu);
  actions.replaceChildren(
    share,
    action('הדפסה / PDF', 'printer', () => window.print()),
    more,
  );
  if (report.domain === 'registration') {
    const compare = new URL(
      import.meta.env.BASE_URL + 'compare/',
      location.origin,
    );
    compare.searchParams.set('a', report.plate);
    actions.insertBefore(
      mark(link('השוואה לרכב נוסף', compare.href), 'columns-2'),
      more,
    );
  }
  const header = output.querySelector('.report-summary');
  header?.insertBefore(actions, header.querySelector('.report-nav'));
}

function showResult(report: Report, checked?: SourceReplies) {
  output.replaceChildren(renderReport(report, checked));
  if (!report.identity) return;
  renderActions(report);
  const signal = controller?.signal;
  const article = output.firstElementChild;
  if (signal && report.fields.kilometer_test_aharon) {
    void import('./mileage')
      .then(({ mileageComparison }) => {
        if (signal.aborted) return;
        const comparison = mileageComparison(report);
        if (comparison) article?.append(comparison);
      })
      .catch(() => {});
  }
  if (signal)
    void import('./model-link')
      .then(({ modelLink }) => modelLink(report, signal))
      .then((anchor) => {
        if (anchor && !signal.aborted) actions.append(anchor);
      })
      .catch(() => {});
  const entry = { plate: report.plate, domain: report.domain };
  write('myoto-recent', [
    entry,
    ...read('myoto-recent').filter((item) => !same(item, entry)),
  ]);
  renderSaved();
}

async function search(plate: string, domain: SearchMode, navigate: boolean) {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  input.value = domain === 'equipment' ? plate : formatPlate(plate);
  if (navigate && address({ plate, domain }).href !== location.href)
    history.pushState(null, '', address({ plate, domain }));
  displayedQuery = location.search;
  lookup.classList.add('lookup-active');
  message.classList.remove('visually-hidden');
  message.textContent = 'בודק במאגרי משרד התחבורה…';
  actions.replaceChildren();
  input.removeAttribute('aria-invalid');
  form.classList.add('is-searching');
  const skeleton = element('div', undefined, 'panel skeleton');
  skeleton.setAttribute('aria-hidden', 'true');
  output.replaceChildren(skeleton);
  output.setAttribute('aria-busy', 'true');
  try {
    const progress = (report: Report) => {
      if (!request.signal.aborted && report.identity && !report.complete) {
        message.textContent = 'התקבלו פרטים ראשונים. הבדיקה נמשכת…';
        output.replaceChildren(renderReport(report));
      }
    };
    const discovery =
      domain === 'auto'
        ? await engine.discover(plate, request.signal, progress)
        : undefined;
    const reports = discovery?.reports ?? [
      await engine.search(
        plate,
        domain === 'auto' ? 'registration' : domain,
        request.signal,
        progress,
        false,
      ),
    ];
    if (request.signal.aborted) return;
    const registration = reports.find(
      (report) => report.domain === 'registration',
    );
    const equipmentCheck = reports.find(
      (report) => report.domain === 'equipment',
    )?.sources.cme;
    const checked =
      equipmentCheck && !equipmentCheck.rows.length
        ? { cme: equipmentCheck }
        : undefined;
    const matches = reports.filter(
      (report) => report.identity || report.recalls.length,
    );
    const incomplete =
      discovery && Object.values(discovery.checks).includes('partial');
    if (matches.length > 1) {
      const chooser = element('section', undefined, 'panel result-chooser');
      chooser.append(
        element(
          'h2',
          matches.every((report) => report.identity)
            ? 'נמצאו שני כלים עם אותו מספר'
            : 'נמצאו נתוני צמ״ה וריקול באותו מספר',
        ),
        element('p', 'בחרו איזה דוח לפתוח.'),
      );
      const list = element('div', undefined, 'choice-grid');
      for (const report of matches) {
        const item = mark(
          button('', () => {
            history.pushState(null, '', address(report));
            displayedQuery = location.search;
            showResult(report);
            const heading = output.querySelector<HTMLElement>(
              '.vehicle-heading h2, .recall-panel h2',
            );
            if (heading) {
              heading.tabIndex = -1;
              heading.focus({ preventScroll: true });
            }
          }),
          report.domain === 'equipment' ? 'construction' : 'car-front',
        );
        const text = element('span');
        text.append(
          element(
            'strong',
            report.domain === 'equipment'
              ? 'צמ״ה'
              : report.identity
                ? 'רכב ברישוי רגיל'
                : 'ריקול לפי לוחית',
          ),
          element(
            'bdi',
            report.identity ? vehicleName(report) : formatPlate(report.plate),
          ),
        );
        item.append(text);
        list.append(item);
      }
      chooser.append(list);
      output.replaceChildren(chooser);
      message.textContent = 'בדיקת המספר הסתיימה.';
    } else if (matches[0]) {
      showResult(matches[0], checked);
      message.classList.toggle('visually-hidden', !incomplete);
      message.textContent = incomplete
        ? 'התקבלה התאמה. הבדיקה של אחד מסוגי הרישוי הייתה חלקית.'
        : 'הבדיקה הסתיימה.';
    } else if (discovery) {
      const messages = {
        empty: 'נבדק ולא נמצאה התאמה',
        partial: 'הבדיקה לא הושלמה',
        found: 'נמצאה התאמה',
      };
      const summary = element('section', undefined, 'panel notice');
      summary.append(
        element('h2', incomplete ? 'הבדיקה חלקית' : 'לא נמצאה התאמה'),
        element(
          'p',
          `רישוי רגיל: ${messages[discovery.checks.registration]}. צמ״ה: ${messages[discovery.checks.equipment]}.`,
        ),
      );
      output.replaceChildren(summary);
      if (registration?.sources.recall)
        output.append(renderRecall(registration, true));
      if (registration) output.append(sourceDetails(registration, checked));
      message.textContent = '';
    } else {
      output.replaceChildren(renderReport(reports[0]));
      message.textContent = '';
    }
  } catch {
    if (!request.signal.aborted) {
      message.textContent = 'הבדיקה נכשלה. אפשר לנסות שוב.';
      output.querySelector('.skeleton')?.remove();
    }
  } finally {
    if (!request.signal.aborted) {
      output.removeAttribute('aria-busy');
      form.classList.remove('is-searching');
    }
  }
}

const fromUrl = () => {
  if (location.search === displayedQuery) return;
  displayedQuery = location.search;
  const parameters = new URLSearchParams(location.search);
  const plate = parsePlate(parameters.get('search') ?? '');
  const type = parameters.get('type');
  if (plate)
    void search(
      plate,
      type === 'equipment' || type === 'registration' ? type : 'auto',
      false,
    );
  else {
    controller?.abort();
    output.removeAttribute('aria-busy');
    output.replaceChildren();
    actions.replaceChildren();
    message.textContent = '';
    input.value = '';
    form.classList.remove('is-searching');
    lookup.classList.remove('lookup-active');
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const plate = parsePlate(input.value);
  if (plate) void search(plate, 'auto', true);
  else {
    message.classList.remove('visually-hidden');
    message.textContent = 'הזינו מספר רישוי או צמ״ה בן 4 עד 8 ספרות.';
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
});
input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
addEventListener('popstate', fromUrl);
renderSaved();
fromUrl();
