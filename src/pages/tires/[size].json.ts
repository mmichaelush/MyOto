import type { APIRoute } from 'astro';
import { tireCatalog, tireModels } from '../../data/tire-catalog';

export function getStaticPaths() {
  return tireCatalog.entries.map(([size, rows]) => ({
    params: { size: size.replace('/', '-').toLowerCase() },
    props: { rows },
  }));
}

export const GET: APIRoute = ({ props }) =>
  Response.json(tireModels(props.rows));
