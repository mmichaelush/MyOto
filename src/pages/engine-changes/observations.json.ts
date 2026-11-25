import { engineChangePeriods } from '../../data/engine-changes';

export function GET() {
  return Response.json(engineChangePeriods);
}
