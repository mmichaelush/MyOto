# MyOto 2.0

אתר בעברית לבדיקת רכב לפי לוחית רישוי או מספר צמ״ה, להשוואת רכבים ולעיון בקטלוג דגמים ממאגרי משרד התחבורה.

## פיתוח ובדיקות

נדרש Node.js 24. ב־Windows אפשר להשתמש ב־`npm.cmd` אם PowerShell חוסם סקריפטים.

```sh
npm ci
npm run verify
npx playwright install chromium
npm run test:e2e
npm run preview -- --host 127.0.0.1 --port 4322
```

כתובת הבדיקה המקומית היא `http://127.0.0.1:4322/MyOto/`. `npm run build` כותב אתר סטטי ל־`dist`. אפשר לשנות את נתיב הבסיס באמצעות `MYOTO_BASE`. לפיתוח עם טעינה מחדש מריצים `npm run dev` בתהליך נפרד.

## שינוי מקורות ועמודים

החיפוש הראשי בודק מספר אחד בשני תחומי רישוי. כשמתקבלות שתי התאמות, כל אחת נפתחת כדוח נפרד. קישורים ישנים עם `?search=` עובדים בחיפוש האוטומטי. קישור עם `type=registration` או `type=equipment` מגביל את הבדיקה לתחום שנבחר.

- מוסיפים מזהה משאב ומקור רשמי ב־`src/data/resources.json`, כללי מפתח והצלבה ב־`src/data/sources.ts` ושילוב במסלול המתאים ב־`src/data/engine.ts`. מוסיפים את מפתחות החוזה ל־`scripts/check-sources.mjs` ומכסים מצבי הצלחה, ריק ושגיאה בבדיקות.
- שדות תצוגה ותיקים מוגדרים ב־`src/domain/labels.json`. כללי מיזוג שייכים ל־`src/domain/report.ts` ועיצוב תאריכים וערכים ל־`src/domain/format.ts`.
- מוסיפים עמודי Astro ב־`src/pages` וקישורים דרך `import.meta.env.BASE_URL`. עמודי קטלוג מקבלים נתיבים מתצלום הנתונים ומייצרים HTML בזמן הבנייה.
- רענון הקטלוג מריץ `node scripts/refresh-catalog.mjs` ואחריו `node scripts/refresh-cohorts.mjs`. במסוף עם תעודת שורש מקומית אפשר להריץ את Node עם `--use-system-ca`. שני הסקריפטים מחליפים את תמונת המצב רק לאחר הצלחה ואימות.

הקטלוג נוצר ממאגר הכמויות הארצי וכולל 142 יצרנים ו־6,028 דגמים בתמונת המצב שנבדקה. ספירות מוצגות לפי קבוצות קוד דגם ושנה. התפלגויות קיימות בשלושה שנתונים שנבדקו, עם שיטת הדגימה ושיעור הכיסוי. רענון הקטלוג מתחדש מנקודת הבקרה של אותו עדכון מקור ומחליף את הקובץ רק לאחר אימות.

בדיקת המקורות החיה נפרדת מהבדיקות האוטומטיות המקומיות. מריצים `node --use-system-ca scripts/check-sources.mjs` כדי לאמת סכמה, מסננים מדויקים ועימוד ארכיון מול הספק. [כיסוי מקורות וחוזה הייצוא](docs/source-coverage.md)

[ארכיטקטורה](docs/architecture.md) · [סקירת שבעת ה־PRs](docs/review-round-2.md) · [אימות ו־QA](docs/validation.md) · [סקירת UI וצילומי מסך](docs/ui-restoration.md) · [שחרור וחזרה לגרסה קודמת](docs/release.md) · [רישיון הנתונים](https://data.gov.il/he/terms-of-use) · [אתר הייצור](https://mmichaelush.github.io/MyOto/)
