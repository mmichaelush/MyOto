import type { Make } from '../data/catalog';

export type FleetCell = [
  make: string,
  year: number,
  type: string,
  active: number,
  inactive: number,
];
export type FleetGroup = { key: string; active: number; inactive: number };
export type FleetFilters = {
  make: string;
  year: string;
  type: string;
  group: 'year' | 'make';
};

export function fleetCells(makes: Make[]): FleetCell[] {
  const cells = new Map<string, FleetCell>();
  for (const make of makes) {
    for (const model of make.models) {
      for (const row of model.records) {
        const key = JSON.stringify([make.id, row.year, row.type]);
        const cell = cells.get(key) ?? [make.id, row.year, row.type, 0, 0];
        cell[3] += row.active;
        cell[4] += row.inactive;
        cells.set(key, cell);
      }
    }
  }
  return [...cells.values()];
}

export function groupFleet(
  cells: FleetCell[],
  filters: FleetFilters,
): FleetGroup[] {
  const groups = new Map<string, FleetGroup>();
  for (const [make, year, type, active, inactive] of cells) {
    if (
      (filters.make && filters.make !== make) ||
      (filters.year && filters.year !== String(year)) ||
      (filters.type && filters.type !== type)
    )
      continue;
    const key = filters.group === 'make' ? make : String(year);
    const row = groups.get(key) ?? { key, active: 0, inactive: 0 };
    row.active += active;
    row.inactive += inactive;
    groups.set(key, row);
  }
  return [...groups.values()];
}

export function activeShare(row: Pick<FleetGroup, 'active' | 'inactive'>) {
  const covered = row.active + row.inactive;
  return covered ? row.active / covered : undefined;
}
