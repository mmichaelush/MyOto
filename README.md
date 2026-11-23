# MyOto 2.0

אתר בעברית לבדיקת רכב לפי לוחית רישוי או מספר צמ״ה, להשוואת רכבים ולעיון בקטלוג דגמים ממאגרי משרד התחבורה.

## פיתוח ובדיקות

נדרש Node.js 24. ב־Windows אפשר להשתמש ב־`npm.cmd` אם PowerShell חוסם סקריפטים.

```sh
npm ci
npm run dev
npm run verify
npx playwright install chromium
npm run test:e2e
npm run preview
```

כתובת הבדיקה המקומית היא `http://localhost:4321/MyOto/`. `npm run build` כותב אתר סטטי ל־`dist`. אפשר לשנות את נתיב הבסיס באמצעות `MYOTO_BASE`.

## שינוי מקורות ועמודים

- מוסיפים מזהה משאב ומקור רשמי ב־`src/data/resources.json`, כללי מפתח והצלבה ב־`src/data/sources.ts` ושילוב במסלול המתאים ב־`src/data/engine.ts`. מוסיפים את מפתחות החוזה ל־`scripts/check-sources.mjs` ומכסים מצבי הצלחה, ריק ושגיאה בבדיקות.
- שדות תצוגה ותיקים מוגדרים ב־`src/domain/labels.json`. כללי מיזוג שייכים ל־`src/domain/report.ts` ועיצוב תאריכים וערכים ל־`src/domain/format.ts`.
- מוסיפים עמודי Astro ב־`src/pages` וקישורים דרך `import.meta.env.BASE_URL`. עמודי קטלוג מקבלים נתיבים מתצלום הנתונים ומייצרים HTML בזמן הבנייה.
- רענון הקטלוג מריץ `node scripts/refresh-catalog.mjs` ואחריו `node scripts/refresh-cohorts.mjs`. במסוף עם תעודת שורש מקומית אפשר להריץ את Node עם `--use-system-ca`. שני הסקריפטים מחליפים את תמונת המצב רק לאחר הצלחה ואימות.

הקטלוג הראשוני מכסה 12 כינויים מסחריים של שלושה יצרנים. ספירות מוצגות לפי קבוצות קוד דגם ושנה. התפלגויות רכבים ונסועה קיימות רק בשנתונים שסומנו למדגם ותועדו בהם הכיסוי ותאריך הדגימה.

[ארכיטקטורה](docs/architecture.md) · [אימות ו־QA](docs/validation.md) · [שחרור וחזרה לגרסה קודמת](docs/release.md) · [רישיון הנתונים](https://data.gov.il/he/terms-of-use) · [אתר הייצור](https://mmichaelush.github.io/MyOto/)
