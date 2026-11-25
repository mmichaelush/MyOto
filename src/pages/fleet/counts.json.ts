import { catalog } from '../../data/catalog';
import { fleetCells } from '../../domain/fleet';

export function GET() {
  return Response.json(fleetCells(catalog.makes));
}
