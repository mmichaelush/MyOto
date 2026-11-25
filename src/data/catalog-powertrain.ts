import type { ModelSpecification } from './catalog';
import { normalizeCatalogTerm } from '../presentation/catalog-search';

export const powertrainFields = [
  ['fuel', 'סוג דלק'],
  ['propulsion', 'טכנולוגיית הנעה'],
  ['drive', 'תצורת הנעה'],
  ['gearbox', 'תיבת הילוכים'],
  ['country', 'ארץ תוצר במפרט'],
  ['feeGroup', 'קבוצת אגרת רישוי'],
  ['safety', 'רמת אבזור בטיחותי'],
] as const;

export function powertrainValues([
  trim,
  fuel,
  ,
  automatic,
  extra,
]: ModelSpecification) {
  return [
    trim ?? '',
    fuel ?? '',
    extra?.propulsion ?? '',
    extra?.drive ?? '',
    automatic === 1 ? 'אוטומטית' : automatic === 0 ? 'ללא תיבה אוטומטית' : '',
    extra?.country ?? '',
    typeof extra?.feeGroup === 'number' &&
    /^[1-7]$/.test(String(extra.feeGroup))
      ? String(extra.feeGroup)
      : '',
    typeof extra?.safety === 'number' && /^[0-8]$/.test(String(extra.safety))
      ? String(extra.safety)
      : '',
  ];
}

export function normalizedPowertrain(spec: ModelSpecification) {
  return powertrainValues(spec).map(normalizeCatalogTerm);
}
