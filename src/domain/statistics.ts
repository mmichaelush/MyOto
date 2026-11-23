export function sampleWindows(size: number, maximum: number, strata: number) {
  if (
    !Number.isSafeInteger(size) ||
    size < 0 ||
    !Number.isSafeInteger(maximum) ||
    maximum < 1 ||
    !Number.isSafeInteger(strata) ||
    strata < 1
  )
    throw new RangeError('Invalid sample dimensions');
  if (size === 0) return [];
  if (size <= maximum) return [{ offset: 0, limit: size }];
  const parts = Math.min(strata, maximum);
  return Array.from({ length: parts }, (_, index) => {
    const start = Math.floor((index * size) / parts);
    const end = Math.floor(((index + 1) * size) / parts);
    const count =
      Math.floor(((index + 1) * maximum) / parts) -
      Math.floor((index * maximum) / parts);
    return {
      offset: start + Math.floor((end - start - count) / 2),
      limit: count,
    };
  });
}

export function mileageSummary(
  rows: readonly { mispar_rechev: number; kilometer_test_aharon: unknown }[],
  minimum = 20,
) {
  const readings = new Map<number, number | null>();
  for (const row of rows) {
    const km = row.kilometer_test_aharon;
    if (
      typeof km !== 'number' ||
      !Number.isSafeInteger(km) ||
      km <= 0 ||
      km > 2_000_000
    )
      continue;
    const prior = readings.get(row.mispar_rechev);
    readings.set(
      row.mispar_rechev,
      prior !== undefined && prior !== km ? null : km,
    );
  }
  const valid = [...readings.values()]
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
  if (!valid.length || valid.length < minimum) return null;
  function quantile(probability: number) {
    const index = probability * (valid.length - 1);
    const lower = Math.floor(index);
    return Math.round(
      valid[lower] + (index - lower) * (valid[Math.ceil(index)] - valid[lower]),
    );
  }
  return {
    n: valid.length,
    p25: quantile(0.25),
    median: quantile(0.5),
    p75: quantile(0.75),
  };
}
