import data from './cohorts.json' with { type: 'json' };

type Cohort = {
  variantKeys: string[];
  n: number;
  frameSize?: number;
  colors: [string, number][];
  ownership: [string, number][];
  fuel: [string, number][];
  trims: [string, number][];
  mileage: { n: number; p25: number; median: number; p75: number } | null;
};
export const cohorts = data.cohorts as unknown as Record<
  string,
  Cohort | undefined
>;
export const fetchedAt = data.fetchedAt;
