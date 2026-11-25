import type { APIRoute } from 'astro';
import { specialtyCatalog } from '../../data/specialty-catalog';

export function getStaticPaths() {
  return Object.entries(specialtyCatalog).map(([source, snapshot]) => ({
    params: { source },
    props: { snapshot },
  }));
}
export const GET: APIRoute = ({ props }) => Response.json(props.snapshot.rows);
