import { modelFilter } from '../data/sources';
import type { Report } from '../domain/report';
import { link } from './dom';

export async function modelLink(report: Report, signal: AbortSignal) {
  const row = report.identity && report.sources[report.identity]?.rows[0];
  const filter = row ? modelFilter(row) : undefined;
  if (!filter) return;
  const { sug_degem, tozeret_cd, degem_cd, shnat_yitzur } = filter;
  const base = import.meta.env.BASE_URL + 'models/';
  const response = await fetch(
    base + 'lookup/' + Math.floor(Number(tozeret_cd) / 100) + '.json',
    { signal },
  );
  if (!response.ok) return;
  const index: Record<string, string> = await response.json();
  const path = index[[sug_degem, tozeret_cd, degem_cd, shnat_yitzur].join('/')];
  return path ? link('לדף דגם ושנתון', base + path) : undefined;
}
