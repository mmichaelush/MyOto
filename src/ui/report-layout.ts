import { button, element } from './dom';

const storageKey = 'myoto-report-order';

export function arrangeReport(grid: HTMLElement) {
  const sections = [...grid.querySelectorAll<HTMLElement>(':scope > section')];
  const key = (section: HTMLElement) =>
    section.querySelector('h3')!.textContent!;
  let saved: string[] = [];
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (Array.isArray(raw))
      saved = raw.filter((value) => typeof value === 'string');
  } catch {}
  const rank = new Map(saved.map((value, index) => [value, index]));
  grid.append(
    ...sections.sort(
      (a, b) => (rank.get(key(a)) ?? Infinity) - (rank.get(key(b)) ?? Infinity),
    ),
  );
  const toggle = button('סידור הדוח', () => {
    const enabled = grid.classList.toggle('arranging');
    toggle.textContent = enabled ? 'סיום סידור' : 'סידור הדוח';
    toggle.setAttribute('aria-pressed', String(enabled));
    handles.forEach(({ container, handle }) => {
      container.hidden = !enabled;
      handle.draggable = enabled;
    });
  });
  toggle.className = 'report-order-toggle';
  toggle.setAttribute('aria-pressed', 'false');
  const status = element('span', undefined, 'visually-hidden');
  status.setAttribute('role', 'status');
  grid.before(status);
  const remember = (section: HTMLElement) => {
    status.textContent = `${key(section)} הועבר למיקום ${[...grid.children].indexOf(section) + 1}.`;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(
          [...grid.querySelectorAll<HTMLElement>(':scope > section')].map(key),
        ),
      );
    } catch {}
  };
  const move = (section: HTMLElement, direction: -1 | 1) => {
    const target =
      direction < 0
        ? section.previousElementSibling
        : section.nextElementSibling;
    if (!target) return;
    if (direction < 0) target.before(section);
    else target.after(section);
    remember(section);
  };
  let dragging: HTMLElement | undefined;
  const handles = sections.map((section) => {
    const container = element('div', undefined, 'section-order');
    container.hidden = true;
    const handle = element('span', 'גרירה', 'drag-handle');
    handle.addEventListener('dragstart', (event) => {
      dragging = section;
      event.dataTransfer?.setData('text/plain', key(section));
    });
    handle.addEventListener('dragend', () => {
      dragging = undefined;
    });
    section.addEventListener('dragover', (event) => {
      if (dragging && dragging !== section) event.preventDefault();
    });
    section.addEventListener('drop', (event) => {
      if (!dragging || dragging === section) return;
      event.preventDefault();
      const old = dragging;
      if (
        old.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING
      )
        section.after(old);
      else section.before(old);
      remember(old);
    });
    const earlier = button('↑', () => {
      move(section, -1);
      earlier.focus();
    });
    const later = button('↓', () => {
      move(section, 1);
      later.focus();
    });
    earlier.setAttribute('aria-label', `הקדמת ${key(section)}`);
    later.setAttribute('aria-label', `הזזת ${key(section)} למטה`);
    container.append(handle, earlier, later);
    section.prepend(container);
    return { container, handle };
  });
  return toggle;
}
