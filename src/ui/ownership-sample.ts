import { endpoint } from '../data/ckan';
import { resources } from '../data/sources';
import { sampleWindows } from '../domain/statistics';
import { element } from './dom';
import { logFailure } from './diagnostics';

const fields = [
  'mispar_rechev',
  'sug_degem',
  'tozeret_cd',
  'degem_cd',
  'shnat_yitzur',
  'baalut',
];
const percent = new Intl.NumberFormat('he-IL', {
  style: 'percent',
  maximumFractionDigits: 1,
});

async function sampleOwnership(
  model: string,
  year: number,
  codes: string[],
  signal: AbortSignal,
) {
  const keys = new Set(codes);
  const manufacturers = [
    ...new Set(codes.map((code) => Number(code.split('/')[1]))),
  ];
  const filters = {
    kinuy_mishari: model,
    shnat_yitzur: year,
    tozeret_cd: manufacturers,
  };
  async function query(limit: number, offset: number) {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      resource_id: resources.private_cars_1.id,
      fields: limit ? fields.join(',') : 'mispar_rechev',
      filters: JSON.stringify(filters),
      limit: String(limit),
      offset: String(offset),
      sort: 'mispar_rechev asc,_id asc',
      include_total: String(!limit),
      ...(!limit && { total_estimation_threshold: '1000000' }),
    }).toString();
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
      credentials: 'omit',
    });
    if (!response.ok) throw new Error('Ownership source unavailable');
    const body = await response.json();
    if (!body.success || !Array.isArray(body.result?.records))
      throw new Error('Unexpected ownership response');
    return body.result;
  }
  const frame = await query(0, 0);
  if (
    frame.total_was_estimated ||
    !Number.isSafeInteger(frame.total) ||
    frame.total < 0
  )
    throw new Error('Ownership sample size unverified');
  const windows = sampleWindows(frame.total as number, 80, 4);
  const pages = await Promise.all(
    windows.map(async ({ limit, offset }) => {
      const { records } = await query(limit, offset);
      if (records.length !== limit)
        throw new Error('Ownership sample changed during lookup');
      return records;
    }),
  );
  const ownership = new Map<string, string | null>();
  for (const row of pages.flat()) {
    if (!row || !fields.every((field) => Object.hasOwn(row, field)))
      throw new Error('Incomplete ownership record');
    const key = [
      row.sug_degem,
      row.tozeret_cd,
      row.degem_cd,
      row.shnat_yitzur,
    ].join('/');
    const plate = String(row.mispar_rechev);
    if (!keys.has(key) || !/^\d{4,8}$/.test(plate)) continue;
    const label =
      typeof row.baalut === 'string' && row.baalut.trim()
        ? row.baalut.trim()
        : 'בעלות לא צוינה';
    const previous = ownership.get(plate);
    ownership.set(
      plate,
      previous === undefined || previous === label ? label : null,
    );
  }
  const counts = new Map<string, number>();
  let size = 0;
  for (const label of ownership.values())
    if (label) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
      size++;
    }
  const published = [...counts]
    .filter(([, n]) => n >= 5)
    .sort((a, b) => b[1] - a[1]);
  const other = size - published.reduce((sum, [, n]) => sum + n, 0);
  if (other) published.push(['סוגים נוספים', other]);
  return { size, published };
}

for (const form of document.querySelectorAll<HTMLFormElement>(
  '.ownership-sample-form',
)) {
  const year = form.querySelector<HTMLSelectElement>('select')!;
  const submit = form.querySelector<HTMLButtonElement>('button')!;
  const output = form.querySelector<HTMLElement>('[data-sample-output]')!;
  const status = form.querySelector<HTMLElement>('[role="status"]')!;
  let active: AbortController | undefined;
  form.hidden = false;
  year.addEventListener('change', () => {
    active?.abort();
    submit.disabled = false;
    status.textContent = '';
    output.replaceChildren();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    active?.abort();
    const request = new AbortController();
    active = request;
    const selected = Number(year.value);
    submit.disabled = true;
    status.textContent = 'אוסף מדגם ממאגר הרישוי…';
    output.replaceChildren();
    try {
      const data = await sampleOwnership(
        form.dataset.model!,
        selected,
        JSON.parse(year.selectedOptions[0].dataset.codes!),
        request.signal,
      );
      if (request.signal.aborted) return;
      if (data.size < 20) {
        status.textContent =
          'נמצאו פחות מ־20 רשומות תואמות. המדגם קטן מדי להצגת אחוזים.';
        return;
      }
      status.textContent = `בעלות רשומה בשנתון ${selected} · מדגם של ${data.size} כלי רכב פעילים`;
      const list = element('ul', undefined, 'distributions');
      for (const [label, n] of data.published) {
        const item = element(
          'li',
          `${label} · ${percent.format(n / data.size)} (${n})`,
        );
        const meter = element('meter');
        meter.min = 0;
        meter.max = data.size;
        meter.value = n;
        meter.setAttribute('aria-label', `${label} מתוך ${data.size}`);
        item.append(meter);
        list.append(item);
      }
      output.append(
        list,
        element(
          'p',
          'מדגם שיטתי של כלי רכב פעילים לפי קודי דגם. האחוזים מתארים את המדגם.',
          'muted',
        ),
      );
    } catch (error) {
      if (!request.signal.aborted) {
        logFailure('sample-model-ownership', error);
        status.textContent = 'מדגם הבעלות אינו זמין כרגע. אפשר לנסות שוב.';
      }
    } finally {
      if (!request.signal.aborted) submit.disabled = false;
    }
  });
}
