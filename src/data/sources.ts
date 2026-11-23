import resources from './resources.json' with { type: 'json' };
import type { Filter, Row, Scalar } from './types';

export { resources };
export type SourceId = keyof typeof resources;

export const primary = [
  'private_cars_1',
  'publicTransport',
  'twoWheeled',
  'heavy',
  'personalImport',
  'offRoad_1',
  'offRoad_3',
  'offRoad_2',
  'frozen_with_model',
  'frozen_no_model',
  'cme',
] as const;
export const statuses = [
  'offRoad_1',
  'offRoad_3',
  'offRoad_2',
  'frozen_with_model',
  'frozen_no_model',
] as const;
export const modelSources = [
  'modelDetails',
  'modelCounts',
  'importers',
] as const;

export function plateFilter(id: SourceId, plate: string): Filter {
  switch (id) {
    case 'offRoad_2':
    case 'offRoad_3':
      return {
        mispar_rechev: [
          ...new Set([plate, plate.padStart(7, '0'), plate.padStart(8, '0')]),
        ],
      };
    case 'cme':
      return { mispar_tzama: Number(plate) };
    case 'recall':
      return { MISPAR_RECHEV: Number(plate) };
    case 'disabledPermit':
      return { 'MISPAR RECHEV': Number(plate) };
    case 'busFleet':
      return { bus_license_id: Number(plate) };
    default:
      return { mispar_rechev: Number(plate) };
  }
}

export function modelFilter(row: Row): Filter | undefined {
  const { sug_degem, tozeret_cd, degem_cd, shnat_yitzur } = row;
  const numeric = (value: Scalar | undefined) =>
    /^\d+$/.test(String(value)) && Number(value) > 0;
  if (
    (sug_degem !== 'M' && sug_degem !== 'P') ||
    ![tozeret_cd, degem_cd, shnat_yitzur].every(numeric)
  )
    return;
  if (Number(degem_cd) === 9999 || Number(shnat_yitzur) < 1900) return;
  return {
    sug_degem,
    tozeret_cd: Number(tozeret_cd),
    degem_cd: Number(degem_cd),
    shnat_yitzur: Number(shnat_yitzur),
  };
}

export function vin(row: Row) {
  return [row.misgeret, row.mispar_shilda, row.shilda]
    .map((value) =>
      String(value ?? '')
        .toUpperCase()
        .replace(/[\s-]/g, ''),
    )
    .find((value) => /^[A-Z0-9]{6,30}$/.test(value) && !/^(.)\1+$/.test(value));
}

export type IdentityMatch = 'verified' | 'candidate' | 'unknown' | 'different';

const code = (value: Scalar | undefined) =>
  /^\d+$/.test(String(value)) &&
  Number(value) > 0 &&
  ![8888, 9999].includes(Number(value))
    ? Number(value)
    : undefined;

export function identityMatch(a: Row, b: Row): IdentityMatch {
  const av = vin(a);
  const bv = vin(b);
  if (av && bv) return av === bv ? 'verified' : 'different';
  const comparable = ['tozeret_cd', 'shnat_yitzur', 'degem_cd']
    .map((key) => [code(a[key]), code(b[key])])
    .filter(([left, right]) => left !== undefined && right !== undefined);
  if (comparable.some(([left, right]) => left !== right)) return 'different';
  return comparable.length >= 2 ? 'candidate' : 'unknown';
}

export function privateContinuation(base: Row, supplement: Row) {
  return (
    ['tozeret_cd', 'degem_cd'].every(
      (key) =>
        code(base[key]) !== undefined &&
        code(base[key]) === code(supplement[key]),
    ) &&
    Boolean(base.sug_degem) &&
    base.sug_degem === supplement.sug_degem
  );
}

export function engineMatch(base: Row, history: Row) {
  const value = String(base.mispar_manoa ?? '')
    .trim()
    .toUpperCase();
  return (
    value.length >= 6 &&
    value ===
      String(history.mispar_manoa ?? '')
        .trim()
        .toUpperCase()
  );
}

export function ttl(id: SourceId): number {
  if (id === 'recall' || id === 'disabledPermit') return 5;
  if (modelSources.some((source) => source === id) || id === 'campaigns')
    return 120;
  return 20;
}
