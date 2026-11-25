import {
  activeShare,
  groupFleet,
  type FleetCell,
  type FleetFilters,
  type FleetGroup,
} from '../domain/fleet';
import { csvBlob } from './csv';
import { element, link } from './dom';

const count = new Intl.NumberFormat('he-IL');
const share = new Intl.NumberFormat('he-IL', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export function initFleet() {
  const form = document.querySelector<HTMLFormElement>('#fleet-filters')!;
  const body = document.querySelector<HTMLTableSectionElement>('#fleet-rows')!;
  const status = document.querySelector<HTMLElement>('#fleet-range')!;
  const dimension = document.querySelector<HTMLElement>('#fleet-dimension')!;
  const exportLink =
    document.querySelector<HTMLAnchorElement>('#fleet-export')!;
  const base = form.dataset.base!;
  const controls = [...form.querySelectorAll('select')];
  const makes = new Map(
    [...form.querySelector<HTMLSelectElement>('[name="make"]')!.options].map(
      ({ value, text }) => [value, text],
    ),
  );
  let source: Promise<FleetCell[]> | undefined;
  let exportUrl: string | undefined;
  let request = 0;

  function render(
    rows: FleetGroup[],
    filters: FleetFilters,
    label: (key: string) => string,
  ) {
    const { group } = filters;
    dimension.textContent = group === 'make' ? 'יצרן' : 'שנת ייצור';
    const header = [
      dimension.textContent,
      'פעילים',
      'לא פעילים',
      'שיעור פעילים במקור',
    ];
    const csv: (string | number)[][] = [header];
    const content = document.createDocumentFragment();
    const total = { key: '', active: 0, inactive: 0 };
    for (const row of rows) {
      total.active += row.active;
      total.inactive += row.inactive;
      const tr = element('tr');
      const title = element('th');
      title.scope = 'row';
      const make = group === 'make' ? row.key : filters.make;
      const year = group === 'year' ? row.key : filters.year;
      const url = new URL(base + 'models/', location.origin);
      if (make && !year) url.pathname += encodeURIComponent(make) + '/';
      else {
        if (make) url.searchParams.set('make', make);
        if (year) url.searchParams.set('year', year);
      }
      title.append(link(label(row.key), url.pathname + url.search));
      const fraction = activeShare(row);
      const cell = element('td');
      if (fraction !== undefined) {
        const meter = element('meter');
        meter.max = 1;
        meter.value = fraction;
        meter.setAttribute('aria-hidden', 'true');
        cell.append(meter, ' ', share.format(fraction));
      } else cell.textContent = '—';
      tr.append(
        title,
        element('td', count.format(row.active)),
        element('td', count.format(row.inactive)),
        cell,
      );
      content.append(tr);
      csv.push([
        label(row.key),
        row.active,
        row.inactive,
        fraction === undefined ? '' : Number((fraction * 100).toFixed(2)),
      ]);
    }
    body.replaceChildren(content);
    status.textContent = rows.length
      ? `${count.format(total.active)} פעילים ו־${count.format(total.inactive)} לא פעילים בפילוח שנבחר.`
      : 'לא נמצאו נתונים לשילוב המסננים שנבחר.';
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = rows.length ? URL.createObjectURL(csvBlob(csv)) : undefined;
    if (exportUrl) exportLink.href = exportUrl;
    else exportLink.removeAttribute('href');
    exportLink.hidden = !exportUrl;
  }

  async function update(save: boolean) {
    const id = ++request;
    const values = new FormData(form);
    const read = (name: string) => String(values.get(name) ?? '');
    const filters: FleetFilters = {
      make: read('make'),
      year: read('year'),
      type: read('type'),
      group: read('group') === 'make' ? 'make' : 'year',
    };
    const sort = read('sort');
    if (save) {
      const url = new URL(location.href);
      for (const control of controls) {
        if (control.selectedIndex > 0)
          url.searchParams.set(control.name, control.value);
        else url.searchParams.delete(control.name);
      }
      if (url.href !== location.href) history.pushState(null, '', url);
    }
    status.textContent = 'טוען נתונים…';
    exportLink.hidden = true;
    body.setAttribute('aria-busy', 'true');
    source ??= fetch(base + 'fleet/counts.json')
      .then((response) => {
        if (!response.ok) throw new Error('Fleet counts unavailable');
        return response.json() as Promise<FleetCell[]>;
      })
      .catch((error: unknown) => {
        source = undefined;
        throw error;
      });
    try {
      const cells = await source;
      if (id !== request) return;
      const label = (key: string) =>
        filters.group === 'make' ? (makes.get(key) ?? key) : key;
      const labelOrder = (a: FleetGroup, b: FleetGroup) =>
        filters.group === 'make'
          ? label(a.key).localeCompare(label(b.key), 'he')
          : Number(b.key) - Number(a.key);
      const rows = groupFleet(cells, filters).sort((a, b) => {
        const rank =
          sort === 'active' || sort === 'inactive' ? b[sort] - a[sort] : 0;
        return rank || labelOrder(a, b);
      });
      render(rows, filters, label);
    } catch {
      if (id !== request) return;
      status.textContent =
        'לא ניתן לטעון את הפילוח. הטבלה הקודמת עדיין מוצגת, ואפשר לנסות שוב.';
    } finally {
      if (id === request) body.removeAttribute('aria-busy');
    }
  }

  function readUrl() {
    const parameters = new URLSearchParams(location.search);
    for (const control of controls) {
      const value = parameters.get(control.name);
      control.selectedIndex = Math.max(
        0,
        [...control.options].findIndex((option) => option.value === value),
      );
    }
    void update(false);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void update(true);
  });
  addEventListener('popstate', readUrl);
  form.hidden = false;
  readUrl();
}
