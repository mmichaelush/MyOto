export type RegistrationMonth = [
  month: number,
  coded: number | null,
  uncoded: number | null,
];

export function registrationTotal([, coded, uncoded]: RegistrationMonth) {
  return coded === null || uncoded === null ? null : coded + uncoded;
}

export function registrationComparison(
  rows: RegistrationMonth[],
  year: number,
) {
  const previous = new Map(
    rows
      .filter(([month]) => Math.floor(month / 100) === year - 1)
      .map((row) => [row[0] % 100, registrationTotal(row)]),
  );
  let currentTotal = 0;
  let previousTotal = 0;
  let months = 0;
  for (const row of rows) {
    if (Math.floor(row[0] / 100) !== year) continue;
    const current = registrationTotal(row);
    const prior = previous.get(row[0] % 100);
    if (current === null || prior == null) continue;
    months++;
    currentTotal += current;
    previousTotal += prior;
  }
  return {
    months,
    currentTotal,
    previousTotal,
    change: previousTotal ? currentTotal / previousTotal - 1 : null,
  };
}
type CatalogMake = {
  id: string;
  models: readonly { id: string; records: readonly { id: string }[] }[];
};

export function registrationModelIndex(makes: readonly CatalogMake[]) {
  const index = new Map<string, string | null>();
  for (const make of makes) {
    for (const model of make.models) {
      const path = make.id + '/' + model.id;
      for (const row of model.records) {
        const key = row.id.split('/').slice(0, 3).join('/');
        if (!index.has(key)) index.set(key, path);
        else if (index.get(key) !== path) index.set(key, null);
      }
    }
  }
  return index;
}
