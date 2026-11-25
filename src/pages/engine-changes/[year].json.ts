import type { APIRoute } from 'astro';
import { retiredByYear } from '../../data/engine-changes';

export function getStaticPaths() {
  return [...retiredByYear].map(([year, rows]) => ({
    params: { year },
    props: { rows },
  }));
}
export const GET: APIRoute = ({ props }) => Response.json(props.rows);
