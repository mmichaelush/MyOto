# הטמעת בדיקת רכב

אפשר להציג את הטופס והתוצאות באמצעות iframe. אין צורך בסקריפט בעמוד המארח. החליפו את הכתובת שלהלן בכתובת ה־Preview או בכתובת האתר לאחר פריסה מאושרת.

```html
<iframe
  src="https://mmichaelush.github.io/MyOto/embed/"
  title="בדיקת רכב לפי מספר רישוי"
  width="100%"
  height="800"
  loading="lazy"
  referrerpolicy="no-referrer"
></iframe>
<p>
  <a href="https://mmichaelush.github.io/MyOto/" target="_blank" rel="noopener"
    >פתיחת MyOto בחלון נפרד</a
  >
</p>
```

כשמארח מאפשר מסגרת אך חוסם סקריפטים בתוכה, קישור הפתיחה עומד לרשות המשתמש. אם המארח מגביל את frame-src, יש לאפשר את מקור הפריסה או להשתמש בקישור ישיר. דף ההטמעה ותצוגת הקטלוג נטענים מאותו אתר. בדיקת כלי רכב דורשת חיבור ל־data.gov.il מהדפדפן.
