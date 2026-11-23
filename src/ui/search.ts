import { VehicleEngine } from '../data/engine';
import { displayValue } from '../domain/format';
import { formatPlate, parsePlate, type SearchDomain } from '../domain/plate';
import type { Report } from '../domain/report';
import { button, element, link } from './dom';
import { renderReport, vehicleName } from './report';

const form = document.querySelector<HTMLFormElement>('#vehicle-form')!;
const input = document.querySelector<HTMLInputElement>('#plate')!;
const type = document.querySelector<HTMLSelectElement>('#domain')!;
const message = document.querySelector<HTMLElement>('#search-status')!;
const output = document.querySelector<HTMLElement>('#report')!;
const actions = document.querySelector<HTMLElement>('#actions')!;
const saved = document.querySelector<HTMLElement>('#saved')!;
const engine = new VehicleEngine();
let controller: AbortController | undefined;

type Saved = { plate: string; domain: SearchDomain };
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

function address(entry: Saved) {
  const url = new URL(import.meta.env.BASE_URL, location.origin);
  url.searchParams.set('search', entry.plate);
  if (entry.domain === 'equipment') url.searchParams.set('type', 'equipment');
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
    section.append(element('h2', heading));
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
    section.append(
      list,
      button('ניקוי ' + heading, () => {
        if (write(key, [])) renderSaved();
      }),
    );
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
      message.textContent = success;
    } catch {
      message.textContent =
        'ההעתקה לא זמינה בדפדפן זה. אפשר לסמן ולהעתיק את הקישור או את הטקסט.';
    }
  };
  const share = button('שיתוף קישור', () => {
    if (navigator.share && window.self === window.top) {
      void navigator
        .share({ title: vehicleName(report), url: url.href })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException) || error.name !== 'AbortError')
            void copy(url.href, 'הקישור הועתק.');
        });
    } else void copy(url.href, 'הקישור הועתק.');
  });
  const save = button('מועדף', () => {
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
  actions.replaceChildren(
    share,
    button('העתקת תקציר', () => {
      void copy(summary, 'תקציר הדוח הועתק.');
    }),
    button('הדפסה / PDF', () => window.print()),
    button('דוח קומפקטי', () => {
      document.body.classList.add('compact-print');
      try {
        window.print();
      } finally {
        document.body.classList.remove('compact-print');
      }
    }),
    button('תמונה PNG', () => {
      const article = output.querySelector<HTMLElement>('.vehicle-report');
      if (!article) return;
      void import('html2canvas')
        .then(({ default: render }) => render(article, { scale: 1 }))
        .then((canvas) => {
          const anchor = link('', canvas.toDataURL());
          anchor.download = `car-${report.plate}.png`;
          anchor.click();
        })
        .catch(() => {
          message.textContent = 'יצירת התמונה נכשלה.';
        });
    }),
    button('JSON', () => {
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
        schema: 1,
      });
    }),
    button('תגובות מקור', () =>
      download(`car-${report.plate}-sources.json`, report.sources),
    ),
    save,
  );
}

async function search(plate: string, domain: SearchDomain, navigate: boolean) {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  input.value = domain === 'registration' ? formatPlate(plate) : plate;
  type.value = domain;
  if (navigate && address({ plate, domain }).href !== location.href)
    history.pushState(null, '', address({ plate, domain }));
  message.textContent = 'בודק במאגרי משרד התחבורה…';
  actions.replaceChildren();
  const skeleton = element('div', undefined, 'panel skeleton');
  skeleton.setAttribute('aria-hidden', 'true');
  output.replaceChildren(skeleton);
  output.setAttribute('aria-busy', 'true');
  try {
    const result = await engine.search(
      plate,
      domain,
      request.signal,
      (report) => {
        if (!request.signal.aborted && report.identity && !report.complete) {
          message.textContent = 'פרטי רישוי התקבלו. בודק מקורות נוספים…';
          output.replaceChildren(renderReport(report));
        }
      },
    );
    if (request.signal.aborted) return;
    output.replaceChildren(renderReport(result));
    message.textContent = result.identity ? 'הבדיקה הסתיימה.' : '';
    if (result.identity) {
      renderActions(result);
      const entry = { plate: result.plate, domain: result.domain };
      write('myoto-recent', [
        entry,
        ...read('myoto-recent').filter((item) => !same(item, entry)),
      ]);
      renderSaved();
    }
  } catch {
    if (!request.signal.aborted)
      message.textContent = 'הבדיקה נכשלה. אפשר לנסות שוב.';
  } finally {
    if (!request.signal.aborted) output.removeAttribute('aria-busy');
  }
}

const fromUrl = () => {
  const parameters = new URLSearchParams(location.search);
  const plate = parsePlate(parameters.get('search') ?? '');
  if (plate)
    void search(
      plate,
      parameters.get('type') === 'equipment' ? 'equipment' : 'registration',
      false,
    );
  else {
    controller?.abort();
    output.removeAttribute('aria-busy');
    output.replaceChildren();
    actions.replaceChildren();
    message.textContent = '';
    input.value = '';
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const plate = parsePlate(input.value);
  if (plate)
    void search(
      plate,
      type.value === 'equipment' ? 'equipment' : 'registration',
      true,
    );
  else {
    message.textContent = 'הזינו מספר רישוי או צמ״ה בן 4 עד 8 ספרות.';
    input.focus();
  }
});
addEventListener('popstate', fromUrl);
renderSaved();
fromUrl();
