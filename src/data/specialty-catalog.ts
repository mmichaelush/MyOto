import raw from './specialty-catalog.json?raw';
import type {
  SpecialtySnapshot,
  SpecialtySource,
} from '../domain/specialty-catalog';

export const specialtyCatalog = (
  JSON.parse(raw) as {
    sources: Record<SpecialtySource, SpecialtySnapshot>;
  }
).sources;
