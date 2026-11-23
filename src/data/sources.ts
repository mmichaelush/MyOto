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
  return String(row.misgeret ?? row.mispar_shilda ?? row.shilda ?? '')
    .trim()
    .toUpperCase();
}

export function identityConflict(a: Row, b: Row): boolean {
  const av = vin(a);
  const bv = vin(b);
  if (av && bv) return av !== bv;
  return ['tozeret_cd', 'shnat_yitzur', 'degem_cd'].some(
    (key) =>
      Number(a[key]) > 0 &&
      Number(b[key]) > 0 &&
      Number(a[key]) !== Number(b[key]),
  );
}

export function ttl(id: SourceId): number {
  if (id === 'recall' || id === 'disabledPermit') return 5;
  if (modelSources.some((source) => source === id) || id === 'campaigns')
    return 120;
  return 20;
}
