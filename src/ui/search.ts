import { VehicleEngine } from '../data/engine';
import { normalizeEngineCode } from '../domain/engine-code';
import { parseTireSize } from '../domain/tires';
import { formatPlate, parsePlate, type SearchDomain } from '../domain/plate';
import type { Report, SourceReplies } from '../domain/report';
import {
  estimatedLicensingFee,
  vehicleViewModel,
} from '../presentation/vehicle-view-model';
import { csvBlob } from './csv';
import { button, element, link } from './dom';
import { renderReport, sourceDetails, vehicleName } from './report';
import { renderRecall } from './recall-panel';
import { mark } from './icons';
import { diagnosticPanel, logFailure, logLookup } from './diagnostics';

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
let diagnostics: HTMLElement | undefined;

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
  } catch (error) {
    logFailure('save-preference', error);
    return false;
  }
}

function same(a: Saved, b: Saved) {
  return a.plate === b.plate && a.domain === b.domain;
}

function address(entry: { plate: string; domain: SearchMode }) {
  const base = import.meta.env.BASE_URL;
  const url = new URL(
    location.pathname === base + 'embed/' ? base + 'embed/' : base,
    location.origin,
  );
  url.searchParams.set('search', entry.plate);
  if (entry.domain !== 'auto') url.searchParams.set('type', entry.domain);
  if (new URLSearchParams(location.search).get('debug') === '1')
    url.searchParams.set('debug', '1');
  return url;
}

function navigateTo(url: URL) {
  try {
    if (url.href !== location.href) history.pushState(null, '', url);
  } catch (error) {
    logFailure('update-address', error);
  }
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
        else {
          message.classList.remove('visually-hidden');
          message.textContent = 'הדפדפן חסם את עדכון הרשימה המקומית.';
        }
      }),
    );
    const list = element('ul', undefined, 'saved-items');
    for (const item of items) {
      const row = element('li');
      const label =
        item.domain === 'equipment'
          ? `צמ״ה ${item.plate}`
          : formatPlate(item.plate);
      const remove = button('×', () => {
        if (
          !write(
            key,
            read(key).filter((entry) => !same(entry, item)),
          )
        ) {
          message.classList.remove('visually-hidden');
          message.textContent = 'הדפדפן חסם את עדכון הרשימה המקומית.';
          return;
        }
        renderSaved();
      });
      remove.className = 'saved-remove';
      remove.setAttribute('aria-label', `הסרת ${label} מרשימת ${heading}`);
      row.append(link(label, address(item).href), remove);
      list.append(row);
    }
    section.append(title, list);
    saved.append(section);
  }
  saved.hidden = !saved.children.length;
  refreshFavorite?.();
}

let refreshFavorite: (() => void) | undefined;

function resetReportActions() {
  actions.replaceChildren();
  refreshFavorite = undefined;
  for (const id of ['footer-vehicle-cost', 'footer-tire-size']) {
    const anchor = document.querySelector<HTMLAnchorElement>('#' + id);
    if (anchor) {
      const url = new URL(anchor.href);
      url.search = '';
      anchor.href = url.href;
    }
  }
}

function download(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const anchor = link('', url);
  anchor.download = filename;
  try {
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function renderActions(report: Report) {
  const url = address(report);
  url.pathname = import.meta.env.BASE_URL;
  url.searchParams.delete('debug');
  const signal = controller?.signal;
  const actionFeedback = (content: string) => {
    if (!signal?.aborted && actions.isConnected) {
      message.classList.remove('visually-hidden');
      message.textContent = content;
    }
  };
  const copy = async (value: string, success: string) => {
    if (signal?.aborted) return;
    try {
      await navigator.clipboard.writeText(value);
      actionFeedback(success);
    } catch (error) {
      logFailure('copy', error);
      actionFeedback('ההעתקה לא זמינה בדפדפן זה. אפשר להעתיק משורת הכתובת.');
    }
  };
  const action = (label: string, icon: string, click: () => void) =>
    mark(button(label, click), icon);
  const print = () => {
    try {
      window.print();
    } catch (error) {
      logFailure('print', error);
      actionFeedback(
        'לא ניתן לפתוח את חלון ההדפסה. אפשר לפתוח את הדוח בחלון נפרד ולנסות שוב.',
      );
    }
  };
  const exportJson = (filename: string, contents: unknown) => {
    try {
      download(
        filename,
        new Blob([JSON.stringify(contents, null, 2)], {
          type: 'application/json',
        }),
      );
    } catch (error) {
      logFailure('export-json', error);
      actionFeedback('לא ניתן להוריד את הקובץ. אפשר לנסות שוב.');
    }
  };
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
  const save = action('', 'star', () => {
    const items = read('myoto-favorites');
    const present = items.some((item) => same(item, report));
    const next = present
      ? items.filter((item) => !same(item, report))
      : [{ plate: report.plate, domain: report.domain }, ...items];
    if (write('myoto-favorites', next)) {
      renderSaved();
    } else
      actionFeedback(
        'לא ניתן לשנות את המועדפים כי הדפדפן חסם את האחסון המקומי.',
      );
  });
  const favoriteLabel = element('span');
  save.append(favoriteLabel);
  refreshFavorite = () => {
    const present = read('myoto-favorites').some((item) => same(item, report));
    favoriteLabel.textContent = present ? 'הסר ממועדפים' : 'הוסף למועדפים';
    save.dataset.favorite = String(present);
  };
  refreshFavorite();
  const more = element('details', undefined, 'report-more');
  const menuLabel = element('span', 'עוד פעולות');
  const trigger = mark(element('summary'), 'chevron-down');
  trigger.append(menuLabel);
  more.append(trigger);
  more.addEventListener('toggle', () => {
    menuLabel.textContent = more.open ? 'הסתר פעולות' : 'עוד פעולות';
  });
  const menu = element('div', undefined, 'report-action-list');
  const imageExport = action('תמונה PNG', 'image', () => {
    const article = output.querySelector<HTMLElement>('.vehicle-report');
    if (!article || signal?.aborted || imageExport.disabled) return;
    const scale = Math.min(
      1,
      8192 / article.scrollHeight,
      Math.sqrt(8_000_000 / (article.scrollWidth * article.scrollHeight)),
    );
    if (scale < 0.45) {
      actionFeedback('הדוח ארוך מדי לתמונה קריאה. אפשר לשמור אותו כ־PDF.');
      return;
    }
    imageExport.disabled = true;
    void (async () => {
      try {
        const { default: render } = await import('html2canvas');
        if (signal?.aborted || !article.isConnected) return;
        const canvas = await render(article, {
          scale,
          ignoreElements: (node) =>
            node.id === 'actions' || node.classList.contains('advanced'),
        });
        if (signal?.aborted) return;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve),
        );
        if (signal?.aborted) return;
        if (!blob) throw new Error('PNG encoding returned no image');
        download(`car-${report.plate}.png`, blob);
      } catch (error) {
        if (!signal?.aborted) {
          logFailure('export-image', error);
          actionFeedback('יצירת התמונה נכשלה. אפשר לשמור את הדוח כ־PDF.');
        }
      } finally {
        imageExport.disabled = false;
      }
    })();
  });
  menu.append(
    imageExport,
    action('CSV', 'download', () => {
      const view = vehicleViewModel(report);
      const rows = [
        ['חלק בדוח', 'שדה', 'ערך', 'מקור'],
        ['זיהוי', 'מספר רישוי', report.plate, ''],
        ['זיהוי', 'רכב', view.title, ''],
        ...(view.status ? [['רישוי', 'מצב רישוי', view.status, '']] : []),
      ];
      for (const section of [...view.sections, ...view.additional]) {
        for (const row of section.groups.flat()) {
          rows.push([
            section.title,
            row.label,
            row.text,
            row.scope === 'model' ? 'מפרט דגם' : '',
          ]);
          for (const alternative of row.differences ?? [])
            rows.push([
              section.title,
              row.label,
              alternative.text,
              alternative.source,
            ]);
        }
      }
      for (const row of view.highlights)
        rows.push(['פרטים עיקריים', row.label, row.text, row.help ?? '']);
      for (const table of view.tables) {
        rows.push([], [table.title, ...table.labels]);
        for (const row of table.rows) rows.push(['', ...row]);
      }
      download(`car-${report.plate}.csv`, csvBlob(rows));
    }),
    action('JSON', 'file-json', () => {
      const { sources, ...data } = report;
      const sourceStatus = Object.fromEntries(
        Object.entries(sources).map(([id, { fetchedAt, issue, rows }]) => [
          id,
          { fetchedAt, issue, count: rows.length },
        ]),
      );
      exportJson(`car-${report.plate}.json`, {
        ...data,
        sourceStatus,
        schema: 2,
      });
    }),
    action('תגובות מקור', 'download', () =>
      exportJson(`car-${report.plate}-sources.json`, report.sources),
    ),
  );
  const fuel = report.fields.sug_delek_nm ?? report.fields.delek_nm;
  const electric = Boolean(
    fuel && !fuel.conflicting && String(fuel.chosen.value).trim() === 'חשמל',
  );
  if (report.domain === 'registration') {
    const cost = new URL(
      import.meta.env.BASE_URL + 'vehicle-cost/',
      location.origin,
    );
    const fee = estimatedLicensingFee(report);
    if (fee !== undefined) cost.searchParams.set('licensing', String(fee));
    if (electric) cost.searchParams.set('unit', 'electric');
    const costLink = document.querySelector<HTMLAnchorElement>(
      '#footer-vehicle-cost',
    );
    if (costLink) costLink.href = cost.href;
  }
  if (report.domain === 'registration' && electric)
    menu.append(
      mark(
        link(
          'מחשבון טעינת רכב חשמלי',
          import.meta.env.BASE_URL + 'charging-cost/',
        ),
        'wallet',
      ),
    );
  if (report.identity === 'private_cars_1') {
    const year = report.fields.shnat_yitzur;
    const importers = new URL(
      import.meta.env.BASE_URL + 'importers/',
      location.origin,
    );
    if (year && !year.conflicting && /^\d{4}$/.test(String(year.chosen.value)))
      importers.searchParams.set('year', String(year.chosen.value));
    const model = report.fields.kinuy_mishari;
    if (model && !model.conflicting && typeof model.chosen.value === 'string')
      importers.searchParams.set('query', model.chosen.value.slice(0, 100));
    menu.append(mark(link('מחירוני רכב חדש', importers.href), 'wallet'));
  }
  const frontTire = report.fields.zmig_kidmi;
  if (report.domain === 'registration') {
    const tires = new URL(
      import.meta.env.BASE_URL + 'tire-size/',
      location.origin,
    );
    const size = String(frontTire?.chosen.value ?? '');
    if (frontTire && !frontTire.conflicting && parseTireSize(size)) {
      tires.searchParams.set('size', size);
      const catalog =
        import.meta.env.BASE_URL + 'tires/?size=' + encodeURIComponent(size);
      menu.append(mark(link('דגמים לפי מידת צמיג', catalog), 'circle-gauge'));
    }
    const tiresLink =
      document.querySelector<HTMLAnchorElement>('#footer-tire-size');
    if (tiresLink) tiresLink.href = tires.href;
  }
  const engine = report.fields.degem_manoa;
  const code =
    engine && !engine.conflicting
      ? normalizeEngineCode(engine.chosen.value)
      : undefined;
  if (code) {
    const directory = new URL(
      import.meta.env.BASE_URL + 'engines/',
      location.origin,
    );
    directory.searchParams.set('code', code);
    menu.append(
      mark(link('חיפוש קוד המנוע בקטלוג', directory.href), 'settings'),
    );
  }
  more.append(menu);
  actions.replaceChildren(
    share,
    action('הדפסה / PDF', 'printer', () => print()),
    save,
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
        if (signal.aborted || !article?.isConnected) return;
        const comparison = mileageComparison(report);
        if (comparison) {
          comparison.id = 'mileage-cohort';
          article.append(comparison);
          const checks = article.querySelector('#buyer-checks ul');
          if (checks) {
            const item = element('li');
            item.append(link('השוואת נסועה למדגם השנתון', '#mileage-cohort'));
            checks.append(item);
          }
        }
      })
      .catch((error) => {
        if (!signal.aborted) logFailure('mileage-comparison', error);
      });
  }
  if (signal)
    void import('./model-link')
      .then(({ modelLink }) => modelLink(report, signal))
      .then((anchor) => {
        const more = actions.querySelector('.report-more');
        if (anchor && more && article?.isConnected && !signal.aborted)
          actions.insertBefore(mark(anchor, 'book-open'), more);
      })
      .catch((error) => {
        if (!signal.aborted) logFailure('catalog-link', error);
      });
  const entry = { plate: report.plate, domain: report.domain };
  write('myoto-recent', [
    entry,
    ...read('myoto-recent').filter((item) => !same(item, entry)),
  ]);
  renderSaved();
}

function resultChooser(matches: Report[], waiting = false) {
  const chooser = element('section', undefined, 'panel result-chooser');
  chooser.append(
    element(
      'h2',
      matches.every((report) => report.identity)
        ? 'נמצאו שני כלים עם אותו מספר'
        : 'נמצאו נתוני צמ״ה וריקול באותו מספר',
    ),
    element(
      'p',
      waiting ? 'פרטי ההתאמות עדיין נטענים.' : 'בחרו איזה דוח לפתוח.',
    ),
  );
  const list = element('div', undefined, 'choice-grid');
  for (const report of matches) {
    const item = mark(
      button('', () => {
        navigateTo(address(report));
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
    item.disabled = waiting;
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
  return chooser;
}

async function search(plate: string, domain: SearchMode, navigate: boolean) {
  controller?.abort();
  diagnostics?.remove();
  diagnostics = undefined;
  const request = new AbortController();
  controller = request;
  input.value = domain === 'equipment' ? plate : formatPlate(plate);
  if (navigate) navigateTo(address({ plate, domain }));
  displayedQuery = location.search;
  lookup.classList.add('lookup-active');
  message.classList.remove('visually-hidden');
  message.textContent = 'בודק במאגרי משרד התחבורה…';
  resetReportActions();
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
        ? await engine.discover(plate, request.signal, (preview) => {
            if (request.signal.aborted) return;
            if (preview.kind === 'registration') {
              progress(preview.report);
            } else {
              message.textContent = 'התקבלו פרטים ראשונים. הבדיקה נמשכת…';
              output.replaceChildren(
                preview.kind === 'collision'
                  ? resultChooser(preview.reports, true)
                  : renderRecall(preview.report, true),
              );
            }
          })
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
    logLookup('search', reports);
    diagnostics = diagnosticPanel('search', reports);
    if (diagnostics) output.after(diagnostics);
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
      output.replaceChildren(resultChooser(matches));
      message.textContent = 'בדיקת המספר הסתיימה.';
    } else if (matches[0]) {
      showResult(matches[0], checked);
      message.classList.toggle('visually-hidden', !incomplete);
      message.textContent = incomplete
        ? 'התקבלה התאמה. הבדיקה של אחד מסוגי הרישוי הייתה חלקית.'
        : 'הבדיקה הסתיימה.';
    } else if (discovery) {
      const summary = element('section', undefined, 'panel notice');
      const recallUnavailable = Boolean(registration?.sources.recall?.issue);
      const unavailable =
        discovery.checks.registration === 'partial' &&
        discovery.checks.equipment === 'partial';
      summary.append(
        element(
          'h2',
          unavailable
            ? 'לא ניתן לבדוק את המספר כרגע'
            : incomplete
              ? 'הבדיקה חלקית'
              : 'לא נמצאה התאמה',
        ),
        element(
          'p',
          unavailable
            ? 'כמה ממאגרי משרד התחבורה לא השיבו. פירוט במקורות המידע.'
            : incomplete
              ? discovery.checks.registration === 'partial'
                ? 'בצמ״ה לא נמצאה התאמה. חלק ממאגרי הרישוי לא החזירו תשובה מלאה.'
                : 'ברישוי רגיל לא נמצאה התאמה. מאגר הצמ״ה לא החזיר תשובה מלאה.'
              : recallUnavailable
                ? 'לא נמצאה התאמה ברישוי ובצמ״ה. בדיקת המקורות חלקית.'
                : 'המספר לא נמצא במאגרי הרישוי והצמ״ה שנבדקו. כדאי לבדוק את הספרות ולהזין שוב.',
        ),
      );
      if (incomplete || recallUnavailable)
        summary.append(
          button('נסה שוב', () => {
            void search(plate, domain, false);
          }),
        );
      output.replaceChildren(summary);
      if (registration) output.append(sourceDetails(registration, checked));
      message.textContent = '';
    } else {
      output.replaceChildren(renderReport(reports[0]));
      message.textContent = '';
    }
  } catch (error) {
    if (!request.signal.aborted) {
      logFailure('search', error);
      message.textContent = 'הבדיקה נכשלה.';
      const notice = element('section', undefined, 'panel notice');
      notice.append(
        button('ניסיון חוזר', () => {
          void search(plate, domain, false);
        }),
      );
      output.replaceChildren(notice);
    }
  } finally {
    if (!request.signal.aborted) {
      output.removeAttribute('aria-busy');
      form.classList.remove('is-searching');
    }
  }
}

const fromUrl = () => {
  const base = import.meta.env.BASE_URL;
  if (location.search === displayedQuery) return;
  displayedQuery = location.search;
  const parameters = new URLSearchParams(location.search);
  if (location.pathname === base && parameters.get('embed') === '1') {
    const target = new URL(base + 'embed/', location.origin);
    parameters.delete('embed');
    target.search = parameters.toString();
    target.hash = location.hash;
    location.replace(target);
    return;
  }
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
    diagnostics?.remove();
    output.removeAttribute('aria-busy');
    output.replaceChildren();
    resetReportActions();
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
try {
  // Remove samples from versions that attached a separate registry test date.
  if (localStorage.getItem('myoto-test-mileage') !== null)
    localStorage.removeItem('myoto-test-mileage');
} catch {
  // Some embedded browsers disallow reading local storage.
}
fromUrl();
