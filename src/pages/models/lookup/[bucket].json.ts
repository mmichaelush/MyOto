import type { APIRoute } from 'astro';
import { catalog } from '../../../data/catalog';

export function getStaticPaths() {
  const buckets = new Map<number, Record<string, string>>();
  for (const make of catalog.makes)
    for (const model of make.models)
      for (const variant of model.records) {
        const bucket = Math.floor(Number(variant.id.split('/')[1]) / 100);
        const index =
          buckets.get(bucket) ??
          (Object.create(null) as Record<string, string>);
        index[variant.id] = `${make.id}/${model.id}/${variant.year}/`;
        buckets.set(bucket, index);
      }
  return [...buckets].map(([bucket, index]) => ({
    params: { bucket: String(bucket) },
    props: { index },
  }));
}
export const GET: APIRoute = ({ props }) => Response.json(props.index);
