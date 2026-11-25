import { electricFleet } from '../../data/electric-fleet';
import { csvBlob } from '../../ui/csv';

export function GET() {
  return new Response(
    csvBlob([['מחוז', 'נפה', 'בעלות', 'כמות'], ...electricFleet.rows]),
  );
}
