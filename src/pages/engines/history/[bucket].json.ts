import { engines } from '../../../data/engine-catalog';

export function getStaticPaths() {
  const buckets = new Map<
    string,
    [string, (typeof engines)[number]['retired']][]
  >();
  for (const engine of engines) {
    if (engine.observed || !engine.retired.length) continue;
    const bucket = engine.id.slice(0, 2).replace(/[^a-z0-9]/g, '_');
    const rows = buckets.get(bucket) ?? [];
    rows.push([engine.id, engine.retired]);
    buckets.set(bucket, rows);
  }
  return [...buckets].map(([bucket, rows]) => ({
    params: { bucket },
    props: { rows },
  }));
}

export function GET({ props }: { props: { rows: unknown } }) {
  return Response.json(props.rows);
}
