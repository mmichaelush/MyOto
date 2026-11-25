export type VehicleCostInputs = {
  distance: number;
  consumption: number;
  unitPrice: number;
  insurance: number;
  maintenance: number;
  licensing: number;
};

export function vehicleCost(input: VehicleCostInputs) {
  if (
    Object.values(input).some((value) => !Number.isFinite(value) || value < 0)
  )
    return;
  const energy = (input.distance / 100) * input.consumption * input.unitPrice;
  const yearly = energy + input.insurance + input.maintenance + input.licensing;
  const perKilometer = input.distance > 0 ? yearly / input.distance : undefined;
  if (
    !Number.isFinite(yearly) ||
    (perKilometer !== undefined && !Number.isFinite(perKilometer))
  )
    return;
  return { energy, yearly, perKilometer };
}
export function ownershipCost(
  annual: number,
  years: number,
  purchase: number,
  resale: number,
) {
  if (
    ![annual, purchase, resale].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 30
  )
    return;
  const operating = annual * years;
  const depreciation = purchase - resale;
  const total = operating + depreciation;
  if (!Number.isFinite(total)) return;
  return { operating, depreciation, total };
}
