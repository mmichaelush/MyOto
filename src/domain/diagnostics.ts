import type { Failure } from '../data/types';

const descriptions: Record<Failure, string> = {
  network: 'החיבור למאגר נכשל',
  timeout: 'המאגר לא השיב בזמן',
  http: 'המאגר החזיר שגיאה',
  'invalid-response': 'התקבלה תשובה בפורמט שאינו נתמך',
  schema: 'שדות התשובה לא תאמו לשאילתה',
  incomplete: 'התקבל רק חלק מהנתונים',
  budget: 'מכסת הבקשות לבדיקה נוצלה',
};

export function issueText(issue: Failure, status?: number) {
  if (status === 429) return 'המאגר מגביל זמנית את מספר הבקשות';
  if (status === 404) return 'המשאב במאגר אינו זמין בכתובת הרשומה';
  return descriptions[issue];
}
