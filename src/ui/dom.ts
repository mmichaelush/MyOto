export function element<K extends keyof HTMLElementTagNameMap>(
  name: K,
  text?: string,
  classes?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  if (text !== undefined) node.textContent = text;
  if (classes) node.className = classes;
  return node;
}

export function link(text: string, href: string) {
  const anchor = element('a', text);
  anchor.href = href;
  return anchor;
}

export function button(text: string, click: () => void) {
  const node = element('button', text, 'secondary');
  node.type = 'button';
  node.addEventListener('click', click);
  return node;
}
