import snapshot from './registrations.json?raw';
import type { RegistrationMonth } from '../domain/registrations';

type RegistrationSnapshot = {
  updatedAt: { monthly: string; monthlyNoModel: string };
  fetchedAt: string;
  months: RegistrationMonth[];
  modelMonths: Record<string, [month: number, count: number][] | undefined>;
};

// The catalog audit validates the compact generated data before production builds.
export const registrations: RegistrationSnapshot = JSON.parse(snapshot);
export const registrationYears = [
  ...new Set(registrations.months.map(([month]) => Math.floor(month / 100))),
].sort((a, b) => b - a);
