export type SearchDomain = 'registration' | 'equipment';

export function parsePlate(value: string): string | undefined {
  const normalized = value.trim().replace(/[\s\u2010-\u2015-]/g, '');
  return /^\d{4,8}$/.test(normalized) && /[1-9]/.test(normalized)
    ? normalized
    : undefined;
}

export function formatPlate(plate: string): string {
  return plate
    .replace(/^(\d{2})(\d{3})(\d{2})$/, '$1-$2-$3')
    .replace(/^(\d{3})(\d{2})(\d{3})$/, '$1-$2-$3');
}
