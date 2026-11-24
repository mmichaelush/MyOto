import { button, element } from './dom';
import { logFailure } from './diagnostics';
import { icon } from './icons';

const storageKey = 'myoto-report-order-v2';
const legacyKey = 'myoto-report-order';
const previousTitles: Record<string, string> = {
  'פרטי הרכב': 'identity',
  'רישוי ובעלות': 'registration',
  'מנוע ודלק': 'engine',
  'גיר והנעה': 'drivetrain',
  'מידות, משקל וגרירה': 'dimensions',
  'צמיגים וחישוקים': 'wheels',
  'בטיחות ואבזור': 'safety',
  'זיהום וסביבה': 'emissions',
  'נתוני צמ״ה': 'equipment',
  'תחבורה ציבורית': 'bus',
  'רכב כבד': 'truck',
  'היסטוריית בעלויות': 'ownership-history',
  'מועדים ברישוי': 'registration-timeline',
  'טסט ושינויי מבנה לפי לוחית': 'history-by-plate',
  'כמות כלי רכב בדגם ובשנתון': 'modelCounts',
  'מפרט דגם מהקטלוג': 'modelDetails',
  'מחיר יבואן לדגם חדש': 'importers',
  'תג חניה לנכה': 'disabledPermit',
  'מפרט צי אוטובוסים': 'busFleet',
  'מסנן פליטות לפי לוחית': 'filters',
};

function readOrder() {
  try {
    const current = localStorage.getItem(storageKey);
    const value: unknown = JSON.parse(
      current ?? localStorage.getItem(legacyKey) ?? '[]',
    );
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value.flatMap((id: unknown) => {
          if (typeof id !== 'string') return [];
          return current
            ? [id]
            : Object.hasOwn(previousTitles, id)
              ? [previousTitles[id]]
              : [];
        }),
      ),
    ];
  } catch {
    return [];
  }
}

export function arrangeReport(grid: HTMLElement) {
  const sections = [
    ...grid.querySelectorAll<HTMLElement>(':scope > [data-section-id]'),
  ];
  const id = (section: HTMLElement) => section.dataset.sectionId!;
  const title = (section: HTMLElement) =>
    section.querySelector('h3')?.textContent ?? '';
  const byId = new Map(sections.map((section) => [id(section), section]));
  let saved = readOrder();
  const rank = new Map(saved.map((value, index) => [value, index]));
  grid.append(
    ...[...sections].sort(
      (a, b) =>
        (rank.get(id(a)) ?? saved.length) - (rank.get(id(b)) ?? saved.length),
    ),
  );

  const status = element('span', undefined, 'visually-hidden');
  status.setAttribute('role', 'status');
  const toolbar = element('div', undefined, 'report-order-bar');
  toolbar.hidden = true;
  grid.before(toolbar, status);
  const reset = button('שחזור סדר ברירת המחדל', () => {
    grid.append(...sections);
    saved = [];
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(legacyKey);
      status.textContent = 'סדר ברירת המחדל שוחזר.';
    } catch (error) {
      logFailure('reset-report-order', error);
      status.textContent = 'הסדר שוחזר בדוח הזה. הדפדפן חסם את שמירת ההעדפה.';
    }
  });
  toolbar.append(
    element('span', 'גררו מקטע אל מקומו החדש או השתמשו בחצים.'),
    reset,
  );

  const remember = (section: HTMLElement) => {
    const ordered = [
      ...grid.querySelectorAll<HTMLElement>(':scope > [data-section-id]'),
    ];
    const visible = ordered.map(id);
    // Keep slots for sections that appear on other vehicles.
    saved = [
      ...saved.map((key) => (byId.has(key) ? visible.shift()! : key)),
      ...visible,
    ];
    status.textContent =
      title(section) + ' הועבר למיקום ' + (ordered.indexOf(section) + 1) + '.';
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
      localStorage.removeItem(legacyKey);
    } catch (error) {
      logFailure('save-report-order', error);
      status.textContent += ' הדפדפן חסם את שמירת ההעדפה.';
    }
  };

  let dragging: HTMLElement | undefined;
  let destination: HTMLElement | undefined;
  let pointer:
    { id: number; section: HTMLElement; x: number; y: number } | undefined;
  function highlight(target?: HTMLElement) {
    if (target === destination) return;
    destination?.classList.remove('section-drop-target');
    destination = target;
    destination?.classList.add('section-drop-target');
  }
  function clearDrag() {
    dragging?.classList.remove('section-dragging');
    dragging = undefined;
    pointer = undefined;
    highlight();
  }
  function place(section: HTMLElement, target: HTMLElement) {
    if (section === target) return;
    if (
      section.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING
    )
      target.after(section);
    else target.before(section);
    remember(section);
  }
  const toggle = button('סידור הדוח', () => {
    const enabled = grid.classList.toggle('arranging');
    toolbar.hidden = !enabled;
    toggle.textContent = enabled ? 'סיום סידור' : 'סידור הדוח';
    toggle.setAttribute('aria-pressed', String(enabled));
    controls.forEach((container) => {
      container.hidden = !enabled;
    });
    if (!enabled) clearDrag();
  });
  toggle.className = 'report-order-toggle';
  toggle.setAttribute('aria-pressed', 'false');
  const controls = sections.map((section) => {
    const container = element('div', undefined, 'section-order');
    container.hidden = true;
    const handle = section.querySelector('h3')!;
    handle.classList.add('drag-handle');
    handle.title = 'גרירה לשינוי סדר';
    const grip = icon('grip');
    grip.classList.add('section-grip');
    handle.append(grip);
    handle.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0 || pointer) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      pointer = {
        id: event.pointerId,
        section,
        x: event.clientX,
        y: event.clientY,
      };
    });
    handle.addEventListener('pointermove', (event) => {
      if (pointer?.section !== section || pointer.id !== event.pointerId)
        return;
      if (!dragging) {
        if (
          Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 5
        )
          return;
        dragging = section;
        section.classList.add('section-dragging');
      }
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-section-id]');
      highlight(
        target?.parentElement === grid && target !== section
          ? target
          : undefined,
      );
      if (event.clientY < 55) window.scrollBy(0, -16);
      if (event.clientY > innerHeight - 55) window.scrollBy(0, 16);
    });
    handle.addEventListener('pointerup', (event) => {
      if (pointer?.id !== event.pointerId) return;
      if (dragging === section && destination) place(section, destination);
      clearDrag();
    });
    handle.addEventListener('pointercancel', clearDrag);
    handle.addEventListener('lostpointercapture', (event) => {
      if (pointer?.id === event.pointerId) clearDrag();
    });
    const move = (direction: -1 | 1, focus: HTMLElement) => {
      const neighbor =
        direction < 0
          ? section.previousElementSibling
          : section.nextElementSibling;
      if (neighbor instanceof HTMLElement) place(section, neighbor);
      focus.focus();
    };
    const earlier = button('↑', () => move(-1, earlier));
    const later = button('↓', () => move(1, later));
    earlier.setAttribute('aria-label', 'הקדמת ' + title(section));
    later.setAttribute('aria-label', 'הזזת ' + title(section) + ' למטה');
    container.append(earlier, later);
    section.prepend(container);
    return container;
  });
  return toggle;
}
