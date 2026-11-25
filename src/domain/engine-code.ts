export function normalizeEngineCode(value: unknown) {
  if (typeof value !== 'string') return;
  const code = value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  return /^[A-Z0-9][A-Z0-9 ./_-]{1,39}$/.test(code) ? code : undefined;
}

export function engineSlug(code: string) {
  return code
    .toLowerCase()
    .replace(
      /[^a-z0-9-]/g,
      (character) => '~' + character.charCodeAt(0).toString(16),
    );
}
