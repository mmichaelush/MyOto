import { registrations, registrationYears } from '../../data/registrations';
import { registrationTotal } from '../../domain/registrations';

export function getStaticPaths() {
  return registrationYears.map((year) => ({
    params: { year: String(year) },
    props: { year },
  }));
}

export function GET({ props }: { props: { year: number } }) {
  const { year } = props;
  const rows = registrations.months.filter(
    ([month]) => Math.floor(month / 100) === year,
  );
  const csv = [
    'month,with_model_code,without_model_code,total',
    ...rows.map((row) => [...row, registrationTotal(row)].join(',')),
  ].join('\r\n');
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
  });
}
