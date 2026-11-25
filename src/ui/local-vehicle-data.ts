export const reportOrderKey = 'myoto-report-order-v2';
export const legacyReportOrderKey = 'myoto-report-order';

const appKeys = [
  'myoto-recent',
  'myoto-favorites',
  reportOrderKey,
  legacyReportOrderKey,
  'myoto-test-mileage',
];

export function clearLocalVehicleData() {
  for (const key of appKeys) localStorage.removeItem(key);
}
