import { VehicleEngine } from '../data/engine';
import { displayValue, fieldLabels } from '../domain/format';
import { formatPlate, parsePlate } from '../domain/plate';
import { element, link } from './dom';
import { vehicleName } from './report';

const engine = new VehicleEngine();
const form = document.querySelector<HTMLFormElement>('#compare')!;
const result = document.querySelector<HTMLElement>('#comparison')!;
const status = document.querySelector<HTMLElement>('#comparison-status')!;
let active: AbortController | undefined;

function fill(restore = false) {
  const query = new URLSearchParams(location.search);
  for (const key of ['a', 'b']) {
    const field = form.elements.namedItem(key) as HTMLInputElement;
    if (restore || !field.value) field.value = query.get(key) ?? '';
  }
}

async function compare(updateUrl: boolean) {
  active?.abort();
  result.hidden = true;
  const values = new FormData(form);
  const a = parsePlate(String(values.get('a') ?? ''));
  const b = parsePlate(String(values.get('b') ?? ''));
  if (!a || !b) {
    status.textContent = updateUrl ? 'הזינו שני מספרי רישוי תקינים.' : '';
    return;
  }
  if (updateUrl) {
    const url = new URL(location.href);
    url.search = new URLSearchParams({ a, b }).toString();
    if (url.href !== location.href) history.pushState(null, '', url);
  }
  const controller = new AbortController();
  active = controller;
  status.textContent = 'בודק את שני כלי הרכב…';
  try {
    const reports = await Promise.all(
      [a, b].map((plate) =>
        engine.search(plate, 'registration', controller.signal),
      ),
    );
    if (controller.signal.aborted) return;
    const table = element('table');
    const header = table.createTHead().insertRow();
    header.append(element('th', 'מאפיין'));
    for (const report of reports) {
      const heading = element('th');
      const url = new URL(import.meta.env.BASE_URL, location.origin);
      url.searchParams.set('search', report.plate);
      heading.append(link(formatPlate(report.plate), url.href));
      header.append(heading);
    }
    for (const column of header.cells) column.scope = 'col';
    const body = table.createTBody();
    const headline = body.insertRow();
    headline.append(element('th', 'תוצאה'));
    for (const report of reports)
      headline.insertCell().textContent = report.identity
        ? vehicleName(report)
        : report.outcome === 'partial'
          ? 'הבדיקה חלקית'
          : 'לא נמצא';
    for (const [key, spec] of Object.entries(fieldLabels)) {
      const entries = reports.map((report) => report.fields[key]?.chosen);
      if (entries.every((entry) => !entry)) continue;
      const row = body.insertRow();
      if (entries.every(Boolean) && entries[0]?.value !== entries[1]?.value)
        row.className = 'different';
      const heading = element('th', spec.label);
      heading.scope = 'row';
      row.append(heading);
      entries.forEach((entry) => {
        row.insertCell().textContent = entry
          ? displayValue(key, entry.value)
          : 'לא זמין';
      });
    }
    result.replaceChildren(table);
    result.hidden = false;
    status.textContent = Object.values(reports).some((report) =>
      Object.values(report.sources).some((source) => source.issue),
    )
      ? 'ההשוואה כוללת מידע חלקי ממקורות זמינים.'
      : 'הבדיקה הסתיימה.';
  } catch {
    if (!controller.signal.aborted)
      status.textContent = 'ההשוואה נכשלה. אפשר לנסות שוב.';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void compare(true);
});
addEventListener('popstate', () => {
  fill(true);
  void compare(false);
});
fill();
void compare(false);
