import { engines } from '../../data/engine-catalog';

export function GET() {
  return Response.json(
    engines.map(({ code, observed, retiredCount }) => [
      code,
      observed,
      retiredCount,
    ]),
  );
}
