# מחקר מאגרי הרכב הממשלתיים עבור MyOto

טיוטת בסיס לביקורת · בדיקות חיות ב־23 בנובמבר 2026, שעון ישראל · גרסת קוד `2fadf2ed47bfce2f0848407b361f6bbf1f355608`

## תוכן עניינים

1. [היקף המחקר ומקורות](#scope)
2. [חוזה ה־API ובדיקות קצה](#api)
3. [קטלוג המשאבים](#catalog)
4. [מדגם ומטריצת הצלבות](#cross)
5. [מילון שדות ודוגמאות JSON](#fields)
6. [כללי איחוד ותכנון ל־MyOto](#design)
7. [דוח QA ופערים](#qa)

<a id="scope"></a>

## 1. היקף המחקר ומקורות

- **רשמי** מציין הגדרת אוכלוסייה או תיאור של המפרסם, או יכולת שתועדה ב־CKAN. **נצפה** מציין נתון מתגובה חיה בחלון המחקר. **מוצע** מציין החלטה ליישום, או פירוש הטעון אימות אם לא פורסם מילון קודים.
- המיפוי מתחיל ב־`DATA_SOURCES`, שרשראות החיפוש וההעשרה ב־`index.html`, ומתרחב בעזרת `package_search` של משרד התחבורה ובדיקה של דפי המקור. טבלאות דגם, תוצר ומסירות מופרדות ממשאבים שמחזירים רשומות לפי רישוי. [קוד MyOto](https://github.com/mmichaelush/MyOto/blob/2fadf2ed47bfce2f0848407b361f6bbf1f355608/index.html#L125-L172) · [קטלוג המשרד](https://data.gov.il/he/organizations/ministry_of_transport) · [שאילתת הקטלוג](https://data.gov.il/api/3/action/package_search?fq=organization%3Aministry_of_transport&rows=200)
- מקורות סמוכים כוללים [רישוי מערך האוטובוסים](https://data.gov.il/he/datasets/ministry_of_transport/licensing_bus_system), שבו יחידת המידע היא קו ונסיעות ברישוי, ו[שירות המשטרה לבדיקת דיווח גניבה](https://www.gov.il/he/service/licence_plate_stolen_vehicle_identification), מתצורת חיפוש לציבור. שירות המשטרה אינו חלק מחוזה CKAN שנבדק. דוח רכב מורחב, שעבודים ועיקולים מוצגים בשירותים המזוהים של הממשלה לפי תיאור השירות. [שירות העברת בעלות](https://www.gov.il/he/service/ownership-vehicles-transfer)
- `private_cars_2` הוא קובץ המשך עם שדות נוספים לפי תיאור רשמי. `offRoad_2` ו־`offRoad_3` הם משאבי ארכיון שעדיין רשומים ונגישים, עם תקופות שונות. תאריך העדכון וקיום משאב נוסף בפני עצמם אינם מוכיחים החלפה. מפעיל המערכת צריך לאמת רשימת משאבים באופן תקופתי מול הקטלוג. [פרטי ומסחרי](https://data.gov.il/he/datasets/ministry_of_transport/private-and-commercial-vehicles) · [ביטול סופי](https://data.gov.il/he/datasets/ministry_of_transport/reshev_bitul_sofi)

<a id="api"></a>

## 2. חוזה ה־API ובדיקות קצה

בסיס `https://data.gov.il/api/3/action/`. הכתובת לכל UUID מופיעה כקישור ישיר בטבלת המשאבים. יש לקודד פרמטרים ב־UTF‑8 וב־URL encoding באמצעות ספריית HTTP. דוגמת שימוש שחזורית, עם משתני קלט מקומיים.

```python
response = session.get(
    "https://data.gov.il/api/3/action/datastore_search",
    params={
        "resource_id": resource_id,
        "filters": json.dumps({key: raw_value}, ensure_ascii=False),
        "limit": 25,
    },
    timeout=10,
)
payload = response.json()
```

| פרמטר                                         | חוזה ותפקיד                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `resource_id`                                 | UUID של משאב. `package_show?id=<slug>` מחזיר את רשימת המשאבים והמטא־דאטה.                                                                              |
| `filters`                                     | אובייקט JSON לפי שם עמודה מדויק. תנאים על עמודות שונות מצטברים. מערך ערכים מאפשר חיפוש מרוכז. טבלאות עברית ועמודות עם רווחים מחייבות שימור השם המדויק. |
| `q`, `plain`, `language`, `full_text`         | חיפוש טקסט והגדרות מנוע החיפוש לפי גרסת CKAN. כשיש מפתח מדויק, העדיפו `filters`.                                                                       |
| `fields`                                      | הקרנת שדות. שימושי לקבלת מפתחות או לבדיקת סכמה ולהקטנת תשובות.                                                                                         |
| `limit`, `offset`, `sort`                     | גודל עמוד, היסט התחלי מ־0 וסדר. לקבע סדר בסריקה. ב־offset גבוה עלות השאילתה יכולה לעלות.                                                               |
| `include_total`, `total_estimation_threshold` | לפי CKAN, שליטה בהחזרת ספירה ובאפשרות אומדן. אם מופיע `total_was_estimated: true`, יש לסמן את המכנה כאומדן.                                            |
| `records_format`, `distinct`                  | CKAN מתעד צורות פלט חלופיות וסינון כפילויות לפי ההקרנה. במחקר נשמר פלט אובייקטים, וכפילויות נשמרו לניתוח.                                              |
| `callback`                                    | MyOto משתמש ב־JSONP. בדיקת העטיפה מתועדת להלן.                                                                                                         |
| `datastore_search_sql?sql=...`                | CKAN מתעד SELECT בקריאה ואת מגבלת זמן הריצה. מזהי טבלה ועמודה בגרשיים כפולים. שימוש מחקרי מצומצם. באתר מומלץ endpoint עם מפתחות ופרמטרים ידועים.       |

[תיעוד DataStore של CKAN](https://docs.ckan.org/en/2.11/maintaining/datastore.html)

מעטפת תשובה שנבדקה כוללת `help`, `success` ובמקרה הצלחה `result`. התיעוד המשותף חל על כל משאבי DataStore בטבלה. `result.fields` מתאר את טיפוסי האחסון, `records` מחזיק את השורות ו־`_id` הוא מזהה שורה טכני. `total`, `total_was_estimated` ו־`_links` מופיעים לפי הפעולה והפרמטרים. תגובה ריקה היא הצלחה עם מערך ריק. יש לבדוק בנפרד HTTP, תקינות JSON, `success`, וצורת `result.records`. בדוח התצפיות מופיעים קודי HTTP שהתקבלו בפועל.

### תצפיות API · 23/11/2026

| בדיקה               | HTTP | success | שורות | total   | limit בתגובה | סוג שגיאה |
| ------------------- | ---- | ------- | ----- | ------- | ------------ | --------- |
| `exact-num`         | 200  | True    | 1     | 1       | 2            | —         |
| `exact-str`         | 200  | True    | 1     | 1       | 2            | —         |
| `positive-array`    | 200  | True    | 2     | 2       | 3            | —         |
| `empty`             | 200  | True    | 0     | 0       | 1            | —         |
| `bad-number`        | 404  | HTML    | 0     | —       | —            | —         |
| `bad-column`        | 404  | HTML    | 0     | —       | —            | —         |
| `bad-json`          | 404  | HTML    | 0     | —       | —            | —         |
| `missing-resource`  | 404  | HTML    | 0     | —       | —            | —         |
| `offset-negative`   | 404  | HTML    | 0     | —       | —            | —         |
| `limit-zero`        | 200  | True    | 0     | 4204593 | 0            | —         |
| `limit-large-empty` | 200  | True    | 0     | —       | 50000        | —         |
| `jsonp`             | 200  | JSONP   | 0     | —       | —            | —         |
| `tag-q`             | 200  | True    | 1     | 1       | 3            | —         |
| `tag-exact`         | 200  | True    | 1     | 1       | 3            | —         |
| `cors`              | 200  | True    | 1     | 4204593 | 1            | —         |
| `history-multiple`  | 200  | True    | 10    | 10      | 50           | —         |
| `modelDetails-site` | 200  | True    | 1     | 1       | 4            | —         |
| `modelDetails-own`  | 200  | True    | 1     | 1       | 5            | —         |
| `modelCounts-site`  | 200  | True    | 1     | 1       | 4            | —         |
| `modelCounts-own`   | 200  | True    | 1     | 1       | 5            | —         |
| `importers-site`    | 200  | True    | 1     | 1       | 4            | —         |
| `importers-own`     | 200  | True    | 1     | 1       | 5            | —         |

בדיקות הקצה כוללות לוחית קיימת כמספר וכמחרוזת, מערך עם שני מפתחות קיימים, 0 לחיפוש ריק, קלט מספרי בלתי ניתן להמרה, עמודה באיות שגוי, JSON קטוע, UUID חסר, offset שלילי ומגבלת שורות מוגדלת עם מסנן ריק. בדיקת הסף ריקה ולכן בודקת את הערך שהשרת מדווח בשדה limit, ללא ניסיון להוריד עשרות אלפי שורות. מגבלת קצב ציבורית מחייבת, SLA ותקרת URL רוחבית לא אומתו.

בדיקת כותרות עם Origin של MyOto החזירה `HTTP/1.1 200 OK`, `Content-Type: application/json;charset=utf-8`, `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: POST, PUT, GET, DELETE, OPTIONS`, `Access-Control-Allow-Headers: X-Non-Standard-CKAN-API-Key, Content-Type`. זו בדיקה של מקור דפדפן אחד ושל endpoint אחד.

גם בקשת SELECT קריאה קצרה קיבלה הצלחה. ההצלבה משתמשת בעיקר ב־filters עם מערך ערכים ובקרת שלמות, עם SQL כגיבוי רק אם בקשת האצווה נכשלה.

**`empty`** · 23/11/2026 · קטע מהתגובה

```json
{
  "success": true,
  "result": {
    "total": 0,
    "limit": 1,
    "total_was_estimated": false,
    "records": []
  }
}
```

**`bad-column`** · 23/11/2026 · קטע מהתגובה

```json
{
  "_non_json": "<!DOCTYPE html>\n<html dir=\"rtl\" lang=\"he-IL\" class=\"no-js\">\n    <head>\n\t\t<meta charset=\"UTF-8\">\n\t\t<meta name=\"",
  "_status": ["404", "text/html"]
}
```

**`bad-number`** · 23/11/2026 · קטע מהתגובה

```json
{
  "_non_json": "<!DOCTYPE html>\n<html dir=\"rtl\" lang=\"he-IL\" class=\"no-js\">\n    <head>\n\t\t<meta charset=\"UTF-8\">\n\t\t<meta name=\"",
  "_status": ["404", "text/html"]
}
```

**`bad-json`** · 23/11/2026 · קטע מהתגובה

```json
{
  "_non_json": "<!DOCTYPE html>\n<html dir=\"rtl\" lang=\"he-IL\" class=\"no-js\">\n    <head>\n\t\t<meta charset=\"UTF-8\">\n\t\t<meta name=\"",
  "_status": ["404", "text/html"]
}
```

**`missing-resource`** · 23/11/2026 · קטע מהתגובה

```json
{
  "_non_json": "<!DOCTYPE html>\n<html dir=\"rtl\" lang=\"he-IL\" class=\"no-js\">\n    <head>\n\t\t<meta charset=\"UTF-8\">\n\t\t<meta name=\"",
  "_status": ["404", "text/html"]
}
```

**`offset-negative`** · 23/11/2026 · קטע מהתגובה

```json
{
  "_non_json": "<!DOCTYPE html>\n<html dir=\"rtl\" lang=\"he-IL\" class=\"no-js\">\n    <head>\n\t\t<meta charset=\"UTF-8\">\n\t\t<meta name=\"",
  "_status": ["404", "text/html"]
}
```

**`history-multiple`** · 23/11/2026 · קטע מהתגובה

```json
{
  "success": true,
  "result": {
    "total": 10,
    "limit": 50,
    "total_was_estimated": false,
    "records": [
      {
        "baalut_dt": 201701,
        "baalut": "פרטי"
      },
      {
        "baalut_dt": 201802,
        "baalut": "סוחר"
      },
      {
        "baalut_dt": 201803,
        "baalut": "פרטי"
      },
      {
        "baalut_dt": 202204,
        "baalut": "סוחר"
      }
    ]
  }
}
```

<a id="catalog"></a>

## 3. קטלוג המשאבים

מפתח החיפוש בטבלה הוא נקודת כניסה מעשית. במשאב שאינו לפי לוחית מוצגים שדות לסינון או לחיבור, בלי הבטחת ייחודיות. `last_modified` הוא זמן משאב מהקטלוג, מוצג כפי שדווח עד רמת הדקה, ללא שיוך אזור זמן. סך הרשומות לפי `total` בבדיקת הסכמה.

| משאב                                                  | כותרת רשמית                                             | מקור רשמי ו־API לפי Resource ID                                                                                                                                                                                                                                                                  | שימוש | שדות חיפוש                                                                       | עודכן            | רשומות      |
| ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------- | ---------------- | ----------- |
| 1. [`private_cars_1`](#resource-private_cars_1)       | מאגר מספרי רישוי של כלי רכב                             | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/private-and-commercial-vehicles/053cea08-09bc-40ec-8f7a-156f0677aff3) · [`053cea08-09bc-40ec-8f7a-156f0677aff3`](https://data.gov.il/api/3/action/datastore_search?resource_id=053cea08-09bc-40ec-8f7a-156f0677aff3&limit=1)        | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:51 | 4,204,593 ≈ |
| 2. [`private_cars_2`](#resource-private_cars_2)       | מספרי רישוי של כלי רכב פרטיים ומסחריים - המשך           | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/private-and-commercial-vehicles/0866573c-40cd-4ca8-91d2-9dd2d7a492e5) · [`0866573c-40cd-4ca8-91d2-9dd2d7a492e5`](https://data.gov.il/api/3/action/datastore_search?resource_id=0866573c-40cd-4ca8-91d2-9dd2d7a492e5&limit=1)        | MyOto | `mispar_rechev`                                                                  | 2026-11-23 04:00 | 4,204,593 ≈ |
| 3. [`personalImport`](#resource-personalimport)       | כלי רכב ביבוא אישי                                      | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/personal_import_vehicles/03adc637-b6fe-402b-9937-7c3d3afc9140) · [`03adc637-b6fe-402b-9937-7c3d3afc9140`](https://data.gov.il/api/3/action/datastore_search?resource_id=03adc637-b6fe-402b-9937-7c3d3afc9140&limit=1)               | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:50 | 27,460      |
| 4. [`offRoad_1`](#resource-offroad_1)                 | כלי רכב שירדו מהכביש ובסטטוס ביטול סופי                 | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/reshev_bitul_sofi/851ecab1-0622-4dbe-a6c7-f950cf82abf9) · [`851ecab1-0622-4dbe-a6c7-f950cf82abf9`](https://data.gov.il/api/3/action/datastore_search?resource_id=851ecab1-0622-4dbe-a6c7-f950cf82abf9&limit=1)                      | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:55 | 1,236,166 ≈ |
| 5. [`offRoad_2`](#resource-offroad_2)                 | כלי רכב שירדו מהכביש ובסטטוס ביטול סופי 2000-2009       | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/reshev_bitul_sofi/ec8cbc34-72e1-4b69-9c48-22821ba0bd6c) · [`ec8cbc34-72e1-4b69-9c48-22821ba0bd6c`](https://data.gov.il/api/3/action/datastore_search?resource_id=ec8cbc34-72e1-4b69-9c48-22821ba0bd6c&limit=1)                      | MyOto | `mispar_rechev`                                                                  | 2023-05-02 04:26 | 499,791 ≈   |
| 6. [`offRoad_3`](#resource-offroad_3)                 | כלי רכב שירדו מהכביש ובסטטוס ביטול סופי 2010-2016       | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/reshev_bitul_sofi/4e6b9724-4c1e-43f0-909a-154d4cc4e046) · [`4e6b9724-4c1e-43f0-909a-154d4cc4e046`](https://data.gov.il/api/3/action/datastore_search?resource_id=4e6b9724-4c1e-43f0-909a-154d4cc4e046&limit=1)                      | MyOto | `mispar_rechev`                                                                  | 2021-11-01 11:07 | 670,293 ≈   |
| 7. [`frozen_with_model`](#resource-frozen_with_model) | מספרי רישוי של כלי רכב לא פעילים עם קוד דגם             | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/rechev_le_pail_with_degem/f6efe89a-fb3d-43a4-bb61-9bf12a9b9099) · [`f6efe89a-fb3d-43a4-bb61-9bf12a9b9099`](https://data.gov.il/api/3/action/datastore_search?resource_id=f6efe89a-fb3d-43a4-bb61-9bf12a9b9099&limit=1)              | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:50 | 612,256 ≈   |
| 8. [`frozen_no_model`](#resource-frozen_no_model)     | מספרי רישוי של כלי רכב לא פעילים וחסרי קוד דגם          | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/rechev_le_pail_without-degem/6f6acd03-f351-4a8f-8ecf-df792f4f573a) · [`6f6acd03-f351-4a8f-8ecf-df792f4f573a`](https://data.gov.il/api/3/action/datastore_search?resource_id=6f6acd03-f351-4a8f-8ecf-df792f4f573a&limit=1)           | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:49 | 1,441,830 ≈ |
| 9. [`heavy`](#resource-heavy)                         | מאגר כלי רכב מעל 3 וחצי טון וכלי רכב חסרי קוד דגם       | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/heavy-truck/cd3acc5c-03c3-4c89-9c54-d40f93c0d790) · [`cd3acc5c-03c3-4c89-9c54-d40f93c0d790`](https://data.gov.il/api/3/action/datastore_search?resource_id=cd3acc5c-03c3-4c89-9c54-d40f93c0d790&limit=1)                            | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:50 | 425,411 ≈   |
| 10. [`cme`](#resource-cme)                            | כלי צמ"ה (ציוד מכני הנדסי)                              | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/construction_equipment/58dc4654-16b1-42ed-8170-98fadec153ea) · [`58dc4654-16b1-42ed-8170-98fadec153ea`](https://data.gov.il/api/3/action/datastore_search?resource_id=58dc4654-16b1-42ed-8170-98fadec153ea&limit=1)                 | MyOto | `mispar_tzama`                                                                   | 2026-11-23 03:50 | 186,332 ≈   |
| 11. [`twoWheeled`](#resource-twowheeled)              | מספרי רישוי של כלי רכב דו גלגליים                       | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/motorcycle/bf9df4e2-d90d-4c0a-a400-19e15af8e95f) · [`bf9df4e2-d90d-4c0a-a400-19e15af8e95f`](https://data.gov.il/api/3/action/datastore_search?resource_id=bf9df4e2-d90d-4c0a-a400-19e15af8e95f&limit=1)                             | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:50 | 193,913 ≈   |
| 12. [`publicTransport`](#resource-publictransport)    | קובץ מספרי רישוי של כלי הרכב הציבוריים הפעילים          | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/kli_rechev_ciburiim/cf29862d-ca25-4691-84f6-1be60dcb4a1e) · [`cf29862d-ca25-4691-84f6-1be60dcb4a1e`](https://data.gov.il/api/3/action/datastore_search?resource_id=cf29862d-ca25-4691-84f6-1be60dcb4a1e&limit=1)                    | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:55 | 66,332      |
| 13. [`history_1`](#resource-history_1)                | היסטוריית כלי רכב פרטיים (1)                            | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/shinui_mivne/56063a99-8a3e-4ff4-912e-5966c0279bad) · [`56063a99-8a3e-4ff4-912e-5966c0279bad`](https://data.gov.il/api/3/action/datastore_search?resource_id=56063a99-8a3e-4ff4-912e-5966c0279bad&limit=1)                           | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:54 | 2,515,222 ≈ |
| 14. [`history_2`](#resource-history_2)                | היסטוריית כלי רכב פרטיים (2)                            | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/shinui_mivne/bb2355dc-9ec7-4f06-9c3f-3344672171da) · [`bb2355dc-9ec7-4f06-9c3f-3344672171da`](https://data.gov.il/api/3/action/datastore_search?resource_id=bb2355dc-9ec7-4f06-9c3f-3344672171da&limit=1)                           | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:59 | 5,616,562 ≈ |
| 15. [`modelDetails`](#resource-modeldetails)          | תוצרים ודגמים של כלי רכב WLTP                           | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/degem-rechev-wltp/142afde2-6228-49f9-8a29-9b6c3a0cbe40) · [`142afde2-6228-49f9-8a29-9b6c3a0cbe40`](https://data.gov.il/api/3/action/datastore_search?resource_id=142afde2-6228-49f9-8a29-9b6c3a0cbe40&limit=1)                      | MyOto | `sug_degem`, `tozeret_cd`, `degem_cd`, `shnat_yitzur`, `ramat_gimur`, `delek_nm` | 2026-11-23 03:50 | 102,614 ≈   |
| 16. [`modelCounts`](#resource-modelcounts)            | מאגר כמויות כלי רכב לפי תוצר, דגם ושנת יצור             | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/degem-rechev-wltp/5e87a7a1-2f6f-41c1-8aec-7216d52a6cf6) · [`5e87a7a1-2f6f-41c1-8aec-7216d52a6cf6`](https://data.gov.il/api/3/action/datastore_search?resource_id=5e87a7a1-2f6f-41c1-8aec-7216d52a6cf6&limit=1)                      | MyOto | `sug_degem`, `tozeret_cd`, `degem_cd`, `shnat_yitzur`                            | 2026-11-23 03:50 | 102,614 ≈   |
| 17. [`recall`](#resource-recall)                      | כלי רכב שלא ביצעו ריקול (קריאת שירות)                   | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/hagbalat_recall/36bf1404-0be4-49d2-82dc-2f1ead4a8b93) · [`36bf1404-0be4-49d2-82dc-2f1ead4a8b93`](https://data.gov.il/api/3/action/datastore_search?resource_id=36bf1404-0be4-49d2-82dc-2f1ead4a8b93&limit=1)                        | MyOto | `MISPAR_RECHEV`                                                                  | 2026-11-23 03:50 | 125,067 ≈   |
| 18. [`importers`](#resource-importers)                | יבואנים ומחירוני רכב חדש                                | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/mehir_yevuan/39f455bf-6db0-4926-859d-017f34eacbcb) · [`39f455bf-6db0-4926-859d-017f34eacbcb`](https://data.gov.il/api/3/action/datastore_search?resource_id=39f455bf-6db0-4926-859d-017f34eacbcb&limit=1)                           | MyOto | `semel_yevuan`, `sug_degem`, `tozeret_cd`, `degem_cd`, `shnat_yitzur`            | 2026-11-23 03:50 | 102,614 ≈   |
| 19. [`disabledPermit`](#resource-disabledpermit)      | כלי רכב עם תג חניה לנכה                                 | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/rechev-tag-nachim/c8b9f9c8-4612-4068-934f-d4acd2e3c06e) · [`c8b9f9c8-4612-4068-934f-d4acd2e3c06e`](https://data.gov.il/api/3/action/datastore_search?resource_id=c8b9f9c8-4612-4068-934f-d4acd2e3c06e&limit=1)                      | MyOto | `MISPAR RECHEV`                                                                  | 2026-11-22 22:39 | 633,044 ≈   |
| 20. [`filters`](#resource-filters)                    | כלי רכב שמותקנים בהם מסננים לצמצום פליטת מזהמים         | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/vehicles_filters_reduce_emissions/7cb2bd95-bf2e-49b6-aea1-fcb5ff6f0473) · [`7cb2bd95-bf2e-49b6-aea1-fcb5ff6f0473`](https://data.gov.il/api/3/action/datastore_search?resource_id=7cb2bd95-bf2e-49b6-aea1-fcb5ff6f0473&limit=1)      | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:50 | 6,571       |
| 21. [`safetyDiscount`](#resource-safetydiscount)      | רכבים זכאים להנחה לאחר התקנת מערכות בטיחות              | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/zakaut-hatkana/83bfb278-7be1-4dab-ae2d-40125a923da1) · [`83bfb278-7be1-4dab-ae2d-40125a923da1`](https://data.gov.il/api/3/action/datastore_search?resource_id=83bfb278-7be1-4dab-ae2d-40125a923da1&limit=1)                         | MyOto | `mispar_rechev`                                                                  | 2026-11-23 03:50 | 1,164,829 ≈ |
| 22. [`busFleet`](#resource-busfleet)                  | ציי רכב אוטובוסים                                       | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/bus_fleet/91d298ed-a260-4f93-9d50-d5e3c5b82ce1) · [`91d298ed-a260-4f93-9d50-d5e3c5b82ce1`](https://data.gov.il/api/3/action/datastore_search?resource_id=91d298ed-a260-4f93-9d50-d5e3c5b82ce1&limit=1)                              | MyOto | `bus_license_id`                                                                 | 2026-11-22 11:39 | 15,412      |
| 23. [`anchors`](#resource-anchors)                    | מאגר כלי רכב המחויבים בהתקנת נקודות עיגון לאבטחת מטענים | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/hatkana_nekudat_igun/786b33b5-75c4-42a3-a241-b1af3c9ca487) · [`786b33b5-75c4-42a3-a241-b1af3c9ca487`](https://data.gov.il/api/3/action/datastore_search?resource_id=786b33b5-75c4-42a3-a241-b1af3c9ca487&limit=1)                   | הרחבה | `mispar_rechev`                                                                  | 2026-11-23 03:50 | 131,289 ≈   |
| 24. [`makers`](#resource-makers)                      | קובץ תוצרים של כלי הרכב הפעילים                         | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/tozeret/d00812f4-58c5-4ce8-b16c-ac13ae52f9d8) · [`d00812f4-58c5-4ce8-b16c-ac13ae52f9d8`](https://data.gov.il/api/3/action/datastore_search?resource_id=d00812f4-58c5-4ce8-b16c-ac13ae52f9d8&limit=1)                                | הרחבה | `tozeret_cd`                                                                     | 2026-11-23 03:50 | 1,313       |
| 25. [`campaigns`](#resource-campaigns)                | Recall                                                  | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/recall/2c33523f-87aa-44ec-a736-edbb0a82975e) · [`2c33523f-87aa-44ec-a736-edbb0a82975e`](https://data.gov.il/api/3/action/datastore_search?resource_id=2c33523f-87aa-44ec-a736-edbb0a82975e&limit=1)                                 | הרחבה | `RECALL_ID`, `TOZAR_CD`, `DEGEM`                                                 | 2026-11-23 03:50 | 3,668       |
| 26. [`monthly`](#resource-monthly)                    | כמות סגירות חודשי עבור רכבים חדשים בעלי קוד דגם         | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/amount_monthly_closures_vehicles/602ac32d-19c0-4b41-88e0-e3ce8a7e80b7) · [`602ac32d-19c0-4b41-88e0-e3ce8a7e80b7`](https://data.gov.il/api/3/action/datastore_search?resource_id=602ac32d-19c0-4b41-88e0-e3ce8a7e80b7&limit=1)       | הרחבה | `sgira_month`, `degem_cd`, `tozeret_cd`, `sug_degem`                             | 2026-11-03 05:34 | 248,281 ≈   |
| 27. [`monthlyNoModel`](#resource-monthlynomodel)      | מאגר כמות כלי רכב חדשים חסרי קוד דגם                    | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/kamut_sgirot_hodshi_rechev_blikoddegem/c967097c-3c74-4adf-a732-0fdd2fda56d9) · [`c967097c-3c74-4adf-a732-0fdd2fda56d9`](https://data.gov.il/api/3/action/datastore_search?resource_id=c967097c-3c74-4adf-a732-0fdd2fda56d9&limit=1) | הרחבה | `sgira_month`, `kvutzat_sug_rechev`, `tozeret_cd`, `degem_nm`                    | 2026-11-03 05:34 | 94,995      |
| 28. [`electric`](#resource-electric)                  | מאגר כמויות כלי רכב חשמליים לפי נפה                     | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/rechavim_hashmalim/07421a4e-5b12-4444-9173-5ca297b31f79) · [`07421a4e-5b12-4444-9173-5ca297b31f79`](https://data.gov.il/api/3/action/datastore_search?resource_id=07421a4e-5b12-4444-9173-5ca297b31f79&limit=1)                     | הרחבה | `mahoz_nm`, `nafa_nm`, `baalut`                                                  | 2026-11-23 04:00 | 89          |
| 29. [`garages`](#resource-garages)                    | מוסכים ומכוני רישוי                                     | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/musachim/bb68386a-a331-4bbc-b668-bba2766d517d) · [`bb68386a-a331-4bbc-b668-bba2766d517d`](https://data.gov.il/api/3/action/datastore_search?resource_id=bb68386a-a331-4bbc-b668-bba2766d517d&limit=1)                               | הרחבה | `mispar_mosah`, `yishuv`, `cod_miktzoa`                                          | 2026-11-23 03:50 | 13,964      |
| 30. [`dealers`](#resource-dealers)                    | סוחרי רכב                                               | [מקור](https://data.gov.il/he/datasets/ministry_of_transport/socharim/eb74ad8c-ffcd-43bb-949c-2244fc8a8651) · [`eb74ad8c-ffcd-43bb-949c-2244fc8a8651`](https://data.gov.il/api/3/action/datastore_search?resource_id=eb74ad8c-ffcd-43bb-949c-2244fc8a8651&limit=1)                               | הרחבה | `het_pei`, `shem`, `yishuv`                                                      | 2026-11-23 03:50 | 10,970      |

<a id="cross"></a>

## 4. מדגם ומטריצת הצלבות

מדגם מכסות לפי משאב. בכל אחד ממשאבי הרישוי שנדגמו, חילקנו את טווח `total` למקטעים, בחרנו היסט התחלה אקראי בכל מקטע והורדנו בלוק רציף בסדר `_id asc`. מחולל Python `random.Random(23112026)`. טבלת QA מפרטת את ההיסטים המדויקים ואת גודל הבקשה. תלות בסדר הייבוא ובבלוקים רציפים יוצרת הטיית אשכולות. אומדן מאגר, עדכון בזמן הריצה ודגימת רשומות במקום כלי רכב יכולים להשפיע על התוצאות.

למטריצה, נבחר תת־מדגם משולב בשכבות עם `random.Random(27112026)`. הוקצו עד 85 מספרים מהקובץ הפרטי הראשי ועד 23 מכל מקור מוצא אחר שיש לו דפי מדגם, ונוספו עד 7 לכל תווית סוג מזוהה מהמקורות הכבד, הציבורי, דו־גלגלי והביטול החדש. בסך הכול נבדקו במטריצה **701 ערכי רישוי ייחודיים**. המספר הנורמלי נגזר מספרות בלבד לאחר הסרת אפסים מובילים להשוואה. עבור עמודות טקסט נבדקו גם גרסאות מרופדות ל־7 ול־8 ספרות. ההשוואה היא לפי מספר ומציינת התאמה מועמדת לזהות. מדגם ממוקד תג, ריקול וארכיון נועד לגלות חפיפות ולכן האחוזים חלים על תת־המדגם בלבד.

### מספר ערכי רישוי שנמצאו בשני המקורות

האלכסון הוא מספר ההתאמות הייחודיות במקור. 0 מציין שלא נצפה צירוף במפתחות שנבדקו. `*` מציין מכנה חלקי בגלל כשל או חיתוך אצווה. צמ״ה מופרד לטבלת בדיקה נפרדת.

**1** `private_cars_1` · **2** `private_cars_2` · **3** `personalImport` · **4** `offRoad_1` · **5** `offRoad_2` · **6** `offRoad_3` · **7** `frozen_with_model` · **8** `frozen_no_model` · **9** `heavy` · **10** `twoWheeled` · **11** `publicTransport` · **12** `history_1` · **13** `history_2` · **14** `recall` · **15** `disabledPermit` · **16** `filters` · **17** `safetyDiscount` · **18** `busFleet` · **19** `anchors`

| מקור | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   | 10  | 11  | 12  | 13  | 14  | 15  | 16  | 17  | 18  | 19  |
| ---- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1    | 183 | 183 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 28  | 85  | 85  | 1   | 49  | 2   | 64  | 0   | 0   |
| 2    | 183 | 183 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 28  | 85  | 85  | 1   | 49  | 2   | 64  | 0   | 0   |
| 3    | 0   | 0   | 24  | 0   | 0   | 0   | 0   | 0   | 0   | 1   | 0   | 8   | 8   | 0   | 3   | 0   | 10  | 0   | 0   |
| 4    | 0   | 0   | 0   | 176 | 0   | 0   | 0   | 0   | 0   | 0   | 2   | 0   | 0   | 0   | 0   | 8   | 0   | 0   | 0   |
| 5    | 0   | 0   | 0   | 0   | 23  | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| 6    | 0   | 0   | 0   | 0   | 0   | 23  | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| 7    | 0   | 0   | 0   | 0   | 0   | 0   | 39  | 0   | 0   | 0   | 0   | 0   | 0   | 15  | 0   | 3   | 0   | 0   | 0   |
| 8    | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 37  | 0   | 0   | 0   | 0   | 0   | 4   | 0   | 5   | 0   | 2   | 9   |
| 9    | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 156 | 0   | 78  | 0   | 0   | 0   | 1   | 7   | 1   | 42  | 36  |
| 10   | 0   | 0   | 1   | 0   | 0   | 0   | 0   | 0   | 0   | 36  | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| 11   | 28  | 28  | 0   | 2   | 0   | 0   | 0   | 0   | 78  | 0   | 108 | 0   | 0   | 1   | 5   | 0   | 1   | 42  | 0   |
| 12   | 85  | 85  | 8   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 93  | 93  | 0   | 25  | 0   | 4   | 0   | 0   |
| 13   | 85  | 85  | 8   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 93  | 93  | 0   | 25  | 0   | 4   | 0   | 0   |
| 14   | 1   | 1   | 0   | 0   | 0   | 0   | 15  | 4   | 0   | 0   | 1   | 0   | 0   | 25  | 0   | 0   | 0   | 0   | 3   |
| 15   | 49  | 49  | 3   | 0   | 0   | 0   | 0   | 0   | 1   | 0   | 5   | 25  | 25  | 0   | 53  | 0   | 14  | 0   | 0   |
| 16   | 2   | 2   | 0   | 8   | 0   | 0   | 3   | 5   | 7   | 0   | 0   | 0   | 0   | 0   | 0   | 25  | 2   | 0   | 6   |
| 17   | 64  | 64  | 10  | 0   | 0   | 0   | 0   | 0   | 1   | 0   | 1   | 4   | 4   | 0   | 14  | 2   | 75  | 0   | 0   |
| 18   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 2   | 42  | 0   | 42  | 0   | 0   | 0   | 0   | 0   | 0   | 44  | 0   |
| 19   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 9   | 36  | 0   | 0   | 0   | 0   | 3   | 0   | 6   | 0   | 0   | 45  |

### חפיפות נבחרות ושיעור מותנה

| מקור א              | מקור ב              | חפיפה | התאמות בא שנבדקו בב | % מתוך המכנה |
| ------------------- | ------------------- | ----- | ------------------- | ------------ |
| `private_cars_1`    | `private_cars_2`    | 183   | 183                 | 100.0%       |
| `private_cars_1`    | `history_1`         | 85    | 183                 | 46.4%        |
| `private_cars_1`    | `history_2`         | 85    | 183                 | 46.4%        |
| `personalImport`    | `private_cars_1`    | 0     | 24                  | 0.0%         |
| `heavy`             | `publicTransport`   | 78    | 156                 | 50.0%        |
| `publicTransport`   | `busFleet`          | 42    | 108                 | 38.9%        |
| `heavy`             | `busFleet`          | 42    | 156                 | 26.9%        |
| `heavy`             | `anchors`           | 36    | 156                 | 23.1%        |
| `heavy`             | `filters`           | 7     | 156                 | 4.5%         |
| `disabledPermit`    | `private_cars_1`    | 49    | 53                  | 92.5%        |
| `disabledPermit`    | `publicTransport`   | 5     | 53                  | 9.4%         |
| `disabledPermit`    | `offRoad_1`         | 0     | 53                  | 0.0%         |
| `disabledPermit`    | `frozen_with_model` | 0     | 53                  | 0.0%         |
| `offRoad_1`         | `private_cars_1`    | 0     | 176                 | 0.0%         |
| `offRoad_2`         | `private_cars_1`    | 0     | 23                  | 0.0%         |
| `offRoad_3`         | `private_cars_1`    | 0     | 23                  | 0.0%         |
| `offRoad_1`         | `frozen_with_model` | 0     | 176                 | 0.0%         |
| `offRoad_1`         | `frozen_no_model`   | 0     | 176                 | 0.0%         |
| `frozen_with_model` | `private_cars_1`    | 0     | 39                  | 0.0%         |
| `frozen_no_model`   | `heavy`             | 0     | 37                  | 0.0%         |
| `twoWheeled`        | `personalImport`    | 1     | 36                  | 2.8%         |
| `recall`            | `private_cars_1`    | 1     | 25                  | 4.0%         |

### שכבות מכוונות · מוניות, אוטובוסים, משא, טרקטורים וביטולים

| מקור / שדה / תווית                                     | נבדקו | private_cars_1 | heavy | publicTransport | busFleet | disabledPermit | offRoad_1 | offRoad_2 | offRoad_3 | anchors | cme |
| ------------------------------------------------------ | ----- | -------------- | ----- | --------------- | -------- | -------------- | --------- | --------- | --------- | ------- | --- |
| heavy/kvutzat_sug_rechev/אוטובוס                       | 7     | 0              | 7     | 6               | 2        | 0              | 0         | 0         | 0         | 0       | 0   |
| heavy/kvutzat_sug_rechev/טרקטור                        | 7     | 0              | 7     | 0               | 0        | 0              | 0         | 0         | 0         | 0       | 0   |
| heavy/kvutzat_sug_rechev/משא                           | 7     | 0              | 7     | 0               | 0        | 0              | 0         | 0         | 0         | 7       | 0   |
| heavy/kvutzat_sug_rechev/פרטי                          | 7     | 0              | 7     | 0               | 0        | 1              | 0         | 0         | 0         | 0       | 3   |
| heavy/kvutzat_sug_rechev/גרור נתמך                     | 7     | 0              | 7     | 0               | 0        | 0              | 0         | 0         | 0         | 1       | 0   |
| heavy/kvutzat_sug_rechev/רכב עבודה                     | 6     | 0              | 6     | 0               | 0        | 0              | 0         | 0         | 0         | 0       | 0   |
| publicTransport/sug_rechev_nm/אוטובוס צבורי עירוני     | 7     | 0              | 7     | 7               | 7        | 0              | 0         | 0         | 0         | 0       | 0   |
| publicTransport/sug_rechev_nm/אוטובוס צבורי עיר מפרק   | 7     | 0              | 7     | 7               | 7        | 0              | 0         | 0         | 0         | 0       | 0   |
| publicTransport/sug_rechev_nm/אוטובוס צבורי להסע מיוחד | 7     | 0              | 7     | 7               | 0        | 0              | 0         | 0         | 0         | 0       | 0   |
| publicTransport/sug_rechev_nm/אוטובוס צבורי בין-עירוני | 6     | 0              | 6     | 6               | 3        | 0              | 0         | 0         | 0         | 0       | 0   |
| publicTransport/sug_rechev_nm/מונית                    | 7     | 7              | 0     | 7               | 0        | 1              | 0         | 0         | 0         | 0       | 0   |
| publicTransport/sug_rechev_nm/אוטובוס זעיר צבורי       | 7     | 7              | 0     | 7               | 0        | 1              | 0         | 0         | 0         | 0       | 0   |
| publicTransport/sug_rechev_nm/אוטובוס צבורי לסיור      | 7     | 0              | 7     | 7               | 0        | 0              | 0         | 0         | 0         | 0       | 0   |
| publicTransport/sug_rechev_nm/אוטובוס פרטי             | 7     | 0              | 7     | 7               | 0        | 0              | 0         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/פרטי נוסעים                    | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 1   |
| offRoad_1/baalut/פרטי                                  | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 1   |
| offRoad_1/sug_rechev_nm/גרור רכין                      | 6     | 0              | 0     | 0               | 0        | 0              | 6         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/גרור לתופי כבלים               | 4     | 0              | 0     | 0               | 0        | 0              | 4         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/גרור פתוח                      | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/גרור לחפצים                    | 1     | 0              | 0     | 0               | 0        | 0              | 1         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/טרקטור רגיל                    | 2     | 0              | 0     | 0               | 0        | 0              | 2         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/גרור סגור                      | 1     | 0              | 0     | 0               | 0        | 0              | 1         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/פרטי נוסעים 5 דלתות            | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 0   |
| offRoad_1/kinuy_mishari/פרטי 4דלת' בלי גג              | 1     | 0              | 0     | 0               | 0        | 0              | 1         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/אוטובוס זעיר פרטי              | 4     | 0              | 0     | 0               | 0        | 0              | 4         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא בלתי אחוד סגור             | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא בלתי אחוד פתוח             | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 4   |
| offRoad_1/sug_rechev_nm/פרטי נוסעים 3 דלתות            | 4     | 0              | 0     | 0               | 0        | 0              | 4         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא ב.אחוד פתוח-תא כפול        | 3     | 0              | 0     | 0               | 0        | 0              | 3         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא תומך                       | 2     | 0              | 0     | 0               | 0        | 0              | 2         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא קירור מבוקר                | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא רכין                       | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 4   |
| offRoad_1/sug_rechev_nm/משא אשפה בדחס                  | 3     | 0              | 0     | 0               | 0        | 0              | 3         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא סגור                       | 2     | 0              | 0     | 0               | 0        | 0              | 2         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא מגבה-נוע                   | 5     | 0              | 0     | 0               | 0        | 0              | 5         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא פתוח                       | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 2   |
| offRoad_1/sug_rechev_nm/משא פתוח דפן הידראולית         | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא סגור דפן הידראולית         | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא פתוח מנוף אחורי            | 2     | 0              | 0     | 0               | 0        | 0              | 2         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/אוטובוס צבורי להסע מיוחד       | 1     | 0              | 0     | 0               | 0        | 0              | 1         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/אוטובוס צבורי לסיור            | 1     | 0              | 0     | 0               | 0        | 0              | 1         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא פתוח מנוף קידמי            | 1     | 0              | 0     | 0               | 0        | 0              | 1         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/אופנוע                         | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/טרקטורון חקלאי                 | 4     | 0              | 0     | 0               | 0        | 0              | 4         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/טרקטורון                       | 5     | 0              | 0     | 0               | 0        | 0              | 5         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/טרקטור חקלאי                   | 2     | 0              | 0     | 0               | 0        | 0              | 2         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא קירור מבוקר דופן הידראולית | 7     | 0              | 0     | 0               | 0        | 0              | 7         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא הובלת משקאות               | 4     | 0              | 0     | 0               | 0        | 0              | 4         | 0         | 0         | 0       | 0   |
| offRoad_1/sug_rechev_nm/משא רכין מנוף קידמי            | 2     | 0              | 0     | 0               | 0        | 0              | 2         | 0         | 0         | 0       | 0   |
| twoWheeled/sug_rechev_nm/אופנוע                        | 7     | 0              | 0     | 0               | 0        | 0              | 0         | 0         | 0         | 0       | 0   |
| twoWheeled/baalut/פרטי                                 | 7     | 0              | 0     | 0               | 0        | 0              | 0         | 0         | 0         | 0       | 0   |

נבדקו גם התאמות שלדה בכיוון טרקטורים בכבד אל צמ״ה (152 רשומות טרקטור זמינות בדגימה, עד 90 לבדיקה) ובכיוון צמ״ה אל כבד (עד 80 רשומות). התקבלו 2 ו־2 שורות בהתאמה. השוואת הספרות בין שני מרחבי המזהים כללה 16 התאמות מספריות בצמ״ה מתוך מדגם הרישוי, לפני בדיקת זהות.

**לפי הגדרה** רכב אחד באותה נקודת זמן אינו גם מבוטל סופית וגם פעיל, ופרסום הלא־פעילים מחריג ביטול סופי ומבדיל בין קיום קוד דגם להיעדרו. אלה כללי אוכלוסייה. הבדלי תקופת חתך, נרמול לוחיות או שיוך לוחית לישויות שונות עשויים ליצור חיתוך מספרי. **לפי תצפית** אפשר להופיע במאגר רישוי ובמקורות היסטוריה, תג, התקנה או יבוא. שיעור 0 במטריצה הוא תוצאה של הבדיקה בלבד.

### דוגמאות מצומצמות להצלבה · 23/11/2026

**מקרה 1** · `heavy` + `publicTransport` · 1 ו־1 שורות בהתאמה; קטעי רשומות מאותו מפתח מנורמל.

```json
{
  "heavy": [
    {
      "shnat_yitzur": 2017,
      "tozeret_cd": 446,
      "mishkal_kolel": 19000,
      "kvutzat_sug_rechev": "אוטובוס"
    }
  ],
  "publicTransport": [
    {
      "shnat_yitzur": 2017,
      "degem_cd": null,
      "tozeret_cd": 446,
      "mishkal_kolel": 19000,
      "sug_rechev_nm": "אוטובוס צבורי לסיור",
      "bitul_dt": ""
    }
  ]
}
```

**מקרה 2** · `publicTransport` + `busFleet` · 1 ו־1 שורות בהתאמה; קטעי רשומות מאותו מפתח מנורמל.

```json
{
  "publicTransport": [
    {
      "shnat_yitzur": 2017,
      "degem_cd": null,
      "tozeret_cd": 1014,
      "mishkal_kolel": 19000,
      "sug_rechev_nm": "אוטובוס צבורי עירוני",
      "bitul_dt": ""
    }
  ],
  "busFleet": [{}]
}
```

**מקרה 3** · `private_cars_1` + `history_2` · 1 ו־3 שורות בהתאמה; קטעי רשומות מאותו מפתח מנורמל.

```json
{
  "private_cars_1": [
    {
      "shnat_yitzur": 2017,
      "degem_cd": 9,
      "tozeret_cd": 139,
      "tokef_dt": "2027-01-03",
      "baalut": "פרטי"
    }
  ],
  "history_2": [
    {
      "baalut": "החכר",
      "baalut_dt": 201701
    },
    {
      "baalut": "פרטי",
      "baalut_dt": 201703
    }
  ]
}
```

**מקרה 4** · `private_cars_1` + `disabledPermit` · 1 ו־1 שורות בהתאמה; קטעי רשומות מאותו מפתח מנורמל.

```json
{
  "private_cars_1": [
    {
      "shnat_yitzur": 2013,
      "degem_cd": 1,
      "tozeret_cd": 637,
      "tokef_dt": "2026-11-30",
      "baalut": "פרטי"
    }
  ],
  "disabledPermit": [{}]
}
```

**מקרה 5** · `heavy` + `anchors` · 1 ו־1 שורות בהתאמה; קטעי רשומות מאותו מפתח מנורמל.

```json
{
  "heavy": [
    {
      "shnat_yitzur": 2018,
      "tozeret_cd": 127,
      "mishkal_kolel": 7500,
      "kvutzat_sug_rechev": "משא"
    }
  ],
  "anchors": [
    {
      "mishkal_kolel": 7500
    }
  ]
}
```

עבור מקרה של התאמה חיובית, הציגו את פרטי הרישוי ואת ההעשרה כשני מקורות. במקרה ביטול מול פעיל, הציגו אזהרת אי־התאמה, תאריכים ומקור. תג חניה יוצג כאינדיקציה שמקורה במאגר הייעודי, בלי פרטים מזהים.

### ממצאים שמכריעים החלטות תכנון

- **פרטי ומסחרי:** קובץ ההמשך החזיר את כל 183 המפתחות הפרטיים/מסחריים שנמצאו בתת־המדגם. במדגם העומק של הקובץ הראשי הופיעו 1,890 שורות מסוג `P` ו־10 מסוג `M`. היחס תלוי בהיסטים ובמכסות. השימוש המוצע בקובץ ההמשך הוא להעשיר צמיגים וגרירה לאחר מציאת רכב.
- **מוניות וסטטוס:** כל שבע המוניות בשכבה הייעודית הופיעו גם בקובץ הפרטי/מסחרי. בנפרד, שתי מוניות בחיתוך הציבורי/ביטול נמצאו עם `bitul_cd="2"`, התיאור ״בטול רשום לפני מכירה״ ותאריך זהה לתאריך הביטול בארכיון, לצד תאריך תוקף מאוחר יותר בשדה הרישוי הציבורי. במקרה כזה יש להציג את סטטוס הביטול ואת התאריכים בשדות נפרדים. הכותרת הרשמית ״פעילים״ ותאריך התוקף לבדם אינם מכריעים.
- **אוטובוסים ומשא:** 78 מפתחות נמצאו בכבד ובציבורי, מהם 42 הופיעו גם בצי האוטובוסים. 36 מפתחות בכבד נמצאו גם ברשימת חובת עיגון. לכן צי, תקינה וחובת עיגון הן העשרות נפרדות.
- **צמ״ה וטרקטורים:** נמצאו הן חפיפות של ספרות בין תחומי המזהים והן שלדות תואמות ברישומים הייעודיים. בדוגמת שלדה תואמת המזהים שונים. חיבור לפי מספר מנורמל לבדו עלול להציג מפרט של כלי אחר.
- **תג חניה:** נמצאו 49 מפתחות משותפים עם הקובץ הפרטי/מסחרי ו־5 עם הציבורי. בשני משאבי הלא־פעילים ובמשאב הביטול העדכני לא נמצאה חפיפה עם רשימת התגים במדגם. שיעור החפיפה מוטה בכוונה בגלל שכבת דגימה מתוך רשימת התגים.
- **ארכיוני ביטול:** בשורות מדגם העומק תאריכי ביטול נעו בין 2017 ל־2026 במשאב החדש, בין 2000 ל־2009 במשאב הראשון ההיסטורי ובין 2010 ל־2016 בשני. בבדיקה ממוקדת באותו ארכיון, החיפוש עם אפס מוביל החזיר שורה אחת והחיפוש עם הערך המקוצר החזיר אפס. לתכנון כיסוי יש להחזיק את שלושת המשאבים ואת צורת הטקסט המקורית.

### תגובות סטטוס של מוניות · 23/11/2026

קטעי הרשומות מוצגים באותו סדר בשני המקורות, לפי התאמה מדויקת של מספר הרישוי שהושמט.

```json
{
  "publicTransport": [
    {
      "sug_rechev_nm": "מונית",
      "shnat_yitzur": 2023,
      "bitul_cd": "2",
      "bitul_nm": "בטול רשום לפני מכירה",
      "bitul_dt": "2026-09-14",
      "tokef_dt": "2027-02-09"
    },
    {
      "sug_rechev_nm": "מונית",
      "shnat_yitzur": 2021,
      "bitul_cd": "2",
      "bitul_nm": "בטול רשום לפני מכירה",
      "bitul_dt": "2026-06-28",
      "tokef_dt": "2027-06-26"
    }
  ],
  "offRoad_1": [
    {
      "sug_rechev_nm": "מונית",
      "shnat_yitzur": 2023,
      "bitul_dt": "2026-09-14"
    },
    {
      "sug_rechev_nm": "מונית",
      "shnat_yitzur": 2021,
      "bitul_dt": "2026-06-28"
    }
  ]
}
```

<a id="fields"></a>

## 5. מילון שדות ודוגמאות JSON

בכל סעיף מונה השדות נגזר מ־`result.fields`. בטיפוס JSON מופיעים ייצוגים שנצפו בפועל. `null / רווח` מדווח כמונים נפרדים מתוך `n`, כאשר רווח כולל מחרוזת ריקה או לבנה בלבד. בעמודה האחרונה מופיעים כל הערכים שנצפו עד 12 ערכים, או עד 8 דוגמאות כשמספר הערכים גבוה יותר. מזהים, פרטי קשר ומידע רגיש הושמטו מהדוגמאות. ערכים שנצפו אינם מילון סגור לכלל המאגר. משמעות השדה מבוססת על כותרת, תיאור רשמי היכן שפורסם ושם שדה. סימון שטעון אימות דורש מפרט מהמפרסם.

<a id="resource-private_cars_1"></a>

### `private_cars_1` · מאגר מספרי רישוי של כלי רכב

**הגדרת המפרסם בתמצית** · רכב פעיל פרטי משנת ייצור 1996, ומסחרי עד 3,500 ק״ג משנת ייצור 1998. קובץ ההמשך מוסיף נתוני צמיגים ומאפיינים משלימים. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/private-and-commercial-vehicles)

**יצירת משאב לפי הקטלוג** · 2019-12-19.

**פרופיל חי** · 1,926 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                     | משמעות                           | DataStore / JSON       | null / רווח | ערכים נצפים                                                                                                                                         |
| ----------------------- | -------------------------------- | ---------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                   | מזהה שורת DataStore              | int / number           | 0 / 0       | הושמט                                                                                                                                               |
| `mispar_rechev`         | מספר רישוי                       | numeric / number       | 0 / 0       | הושמט                                                                                                                                               |
| `tozeret_cd`            | קוד תוצר                         | numeric / number       | 0 / 0       | 103 · `1014`, `588`, `590`, `839`, `413`, `672`, `299`, `751`                                                                                       |
| `sug_degem`             | סוג דגם                          | text / string          | 0 / 0       | 2 · `"P"`, `"M"`                                                                                                                                    |
| `tozeret_nm`            | שם תוצר                          | text / string          | 0 / 0       | 103 · `"בי ווי די סין"`, `"מזדה יפן"`, `"מיצובישי יפן"`, `"טויוטה טורקיה"`, `"טויוטה יפן"`, `"טויוטה צרפת"`, `"סוזוקי הונגריה"`, `"שברולט ד.קוריא"` |
| `degem_cd`              | קוד דגם                          | numeric / number       | 0 / 0       | 448 · `3`, `4`, `53`, `292`, `2`, `24`, `431`, `661`                                                                                                |
| `degem_nm`              | שם דגם                           | text / string          | 0 / 0       | 514 · `"SC2E-SC2E01"`, `"SC2E-SC2E"`, `"BK12Z"`, `"SC3E-SC3H0B"`, `"ZRE181L-DEXNPW"`, `"BL12Z"`, `"GF7WXTXXL6"`, `"XTA03"`                          |
| `ramat_gimur`           | רמת גימור                        | text / string          | 0 / 21      | 279 · `"COMFORT"`, `"DESIGN"`, `"ACTIVE"`, `"INSTYLE"`, `"GLX"`, `"STYLE"`, `"SUN"`, `"URBAN"`                                                      |
| `ramat_eivzur_betihuty` | רמת בטיחות                       | numeric / null, number | 750 / 0     | 8 · `6`, `1`, `2`, `7`, `3`, `5`, `4`, `8`                                                                                                          |
| `kvutzat_zihum`         | קבוצת זיהום                      | numeric / null, number | 440 / 0     | 15 · `15`, `14`, `3`, `2`, `7`, `13`, `4`, `12`                                                                                                     |
| `shnat_yitzur`          | שנת ייצור                        | numeric / number       | 0 / 0       | 24 · `2024`, `2026`, `2023`, `2021`, `2022`, `2025`, `2020`, `2018`                                                                                 |
| `degem_manoa`           | דגם מנוע                         | text / string          | 0 / 0       | 287 · `"2G"`, `"2ZR"`, `"TZ200XSQ"`, `"Z6"`, `"A25A"`, `"4J11"`, `"PE"`, `"M15A"`                                                                   |
| `mivchan_acharon_dt`    | טסט אחרון                        | text / string          | 0 / 0       | 485 · `"2026-08-09"`, `"2026-02-26"`, `"2026-02-23"`, `"2026-02-25"`, `"2026-02-18"`, `"2026-07-19"`, `"2024-01-01"`, `"2025-12-23"`                |
| `tokef_dt`              | תוקף רישיון                      | text / string          | 0 / 0       | 401 · `"2026-12-31"`, `"2027-01-01"`, `"2027-01-03"`, `"2027-02-25"`, `"2027-01-07"`, `"2027-01-02"`, `"2027-02-24"`, `"2027-01-10"`                |
| `baalut`                | בעלות נוכחית                     | text / string          | 0 / 0       | 5 · `"פרטי"`, `"ליסינג"`, `"חברה"`, `"סוחר"`, `"השכרה"`                                                                                             |
| `misgeret`              | מספר שלדה                        | text / string          | 0 / 0       | הושמט                                                                                                                                               |
| `tzeva_cd`              | קוד · צבע                        | numeric / number       | 0 / 0       | 56 · `80`, `22`, `29`, `10`, `20`, `11`, `25`, `30`                                                                                                 |
| `tzeva_rechev`          | צבע                              | text / string          | 0 / 0       | 56 · `"שנהב לבן"`, `"אפור כהה"`, `"כסף מטלי"`, `"שחור"`, `"אפור"`, `"שחור מטלי"`, `"כסף"`, `"כחול"`                                                 |
| `zmig_kidmi`            | מידות צמיג קדמי                  | text / string          | 0 / 0       | 200 · `"235/50 R18"`, `"195/65R15"`, `"205/55R16"`, `"185/65R15"`, `"215/55R17"`, `"225/55R18"`, `"185/55R15"`, `"225/65R17"`                       |
| `zmig_ahori`            | מידות צמיג אחורי                 | text / string          | 0 / 50      | 205 · `"235/50 R18"`, `"205/55R16"`, `"195/65R15"`, `"185/65R15"`, `"215/55R17"`, `"225/55R18"`, `"185/55R15"`, `"225/65R17"`                       |
| `sug_delek_nm`          | סוג דלק                          | text / string          | 0 / 0       | 5 · `"בנזין"`, `"חשמל"`, `"חשמל/בנזין"`, `"דיזל"`, `"גפמ\""`                                                                                        |
| `horaat_rishum`         | קוד הוראת רישום                  | numeric / null, number | 241 / 0     | 515 · `221623`, `200921`, `240604`, `260174`, `250029`, `250034`, `201107`, `251039`                                                                |
| `moed_aliya_lakvish`    | מועד עלייה לכביש בגרעיניות המקור | text / string          | 0 / 53      | 207 · `"2024-1"`, `"2024-2"`, `"2023-1"`, `"2024-3"`, `"2026-1"`, `"2026-2"`, `"2021-1"`, `"2020-1"`                                                |
| `kinuy_mishari`         | כינוי מסחרי                      | text / string          | 0 / 0       | 311 · `"ATTO 3"`, `"MAZDA 3"`, `"RAV 4 HYBRID"`, `"OUTLANDER"`, `"SPORTAGE"`, `"COROLLA"`, `"MAZDA 2"`, `"SPARK"`                                   |

**JSON בפועל · 23/11/2026 12:59:14** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tozeret_cd": 481,
        "sug_degem": "P",
        "tozeret_nm": "יונדאי ד. קורי",
        "degem_cd": 1181,
        "degem_nm": "SH81X",
        "ramat_gimur": "LUXURY",
        "ramat_eivzur_betihuty": null,
        "kvutzat_zihum": 15,
        "shnat_yitzur": 2010,
        "degem_manoa": "D4HB",
        "mivchan_acharon_dt": "2026-11-21",
        "tokef_dt": "2027-10-30",
        "baalut": "פרטי",
        "tzeva_cd": 27
      },
      {
        "tozeret_cd": 839,
        "sug_degem": "P",
        "tozeret_nm": "טויוטה טורקיה",
        "degem_cd": 31,
        "degem_nm": "ZZE121L-DEPDKW",
        "ramat_gimur": "SUN",
        "ramat_eivzur_betihuty": null,
        "kvutzat_zihum": null,
        "shnat_yitzur": 2004,
        "degem_manoa": "3ZZ",
        "mivchan_acharon_dt": "2026-11-20",
        "tokef_dt": "2027-05-27",
        "baalut": "פרטי",
        "tzeva_cd": 80
      }
    ]
  }
}
```

<a id="resource-private_cars_2"></a>

### `private_cars_2` · מספרי רישוי של כלי רכב פרטיים ומסחריים - המשך

**הגדרת המפרסם בתמצית** · רכב פעיל פרטי משנת ייצור 1996, ומסחרי עד 3,500 ק״ג משנת ייצור 1998. קובץ ההמשך מוסיף נתוני צמיגים ומאפיינים משלימים. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/private-and-commercial-vehicles)

**יצירת משאב לפי הקטלוג** · 2022-07-05.

**פרופיל חי** · 1,126 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                       | משמעות              | DataStore / JSON | null / רווח | ערכים נצפים                                                                 |
| ------------------------- | ------------------- | ---------------- | ----------- | --------------------------------------------------------------------------- |
| `_id`                     | מזהה שורת DataStore | int / number     | 0 / 0       | הושמט                                                                       |
| `mispar_rechev`           | מספר רישוי          | numeric / number | 0 / 0       | הושמט                                                                       |
| `tozeret_cd`              | קוד תוצר            | numeric / number | 0 / 0       | 101 · `481`, `885`, `299`, `1014`, `413`, `588`, `672`, `590`               |
| `sug_degem`               | סוג דגם             | text / string    | 0 / 0       | 2 · `"P"`, `"M"`                                                            |
| `degem_cd`                | קוד דגם             | numeric / number | 0 / 0       | 373 · `52`, `73`, `53`, `40`, `32`, `246`, `19`, `15`                       |
| `kod_omes_tzmig_kidmi`    | קוד עומס (קדמי)     | numeric / number | 0 / 0       | 40 · `91`, `99`, `94`, `84`, `92`, `96`, `88`, `0`                          |
| `kod_omes_tzmig_ahori`    | קוד עומס (אחורי)    | numeric / number | 0 / 0       | 40 · `91`, `99`, `94`, `84`, `0`, `92`, `96`, `88`                          |
| `kod_mehirut_tzmig_kidmi` | קוד מהירות (קדמי)   | text / string    | 0 / 48      | 10 · `"H"`, `"V"`, `"T"`, `"W"`, `"S"`, `"Y"`, `"R"`, `"U"`, `"Q"`, `"H/"`  |
| `kod_mehirut_tzmig_ahori` | קוד מהירות (אחורי)  | text / string    | 0 / 48      | 10 · `"H"`, `"V"`, `"T"`, `"W"`, `"S"`, `"Y"`, `"R"`, `"U"`, `"Q"`, `"H/"`  |
| `grira_nm`                | תיאור גרירה         | text / string    | 0 / 0       | 4 · `"אין וו גרירה"`, `"וו גרירה קבוע"`, `"וו גרירה נשלף"`, `"יש וו גרירה"` |

**JSON בפועל · 23/11/2026 12:59:29** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tozeret_cd": 885,
        "sug_degem": "P",
        "degem_cd": 512,
        "kod_omes_tzmig_kidmi": 88,
        "kod_omes_tzmig_ahori": 88,
        "kod_mehirut_tzmig_kidmi": "H",
        "kod_mehirut_tzmig_ahori": "H",
        "grira_nm": "אין וו גרירה"
      },
      {
        "tozeret_cd": 588,
        "sug_degem": "P",
        "degem_cd": 772,
        "kod_omes_tzmig_kidmi": 0,
        "kod_omes_tzmig_ahori": 0,
        "kod_mehirut_tzmig_kidmi": "",
        "kod_mehirut_tzmig_ahori": "",
        "grira_nm": "אין וו גרירה"
      }
    ]
  }
}
```

<a id="resource-personalimport"></a>

### `personalImport` · כלי רכב ביבוא אישי

**הגדרת המפרסם בתמצית** · כלי רכב פעילים ביבוא אישי, כולל סוג יבוא, מבחן רישוי ונתונים טכניים. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/personal_import_vehicles)

**יצירת משאב לפי הקטלוג** · 2020-01-29.

**פרופיל חי** · 576 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                  | משמעות                           | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                                              |
| -------------------- | -------------------------------- | ---------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                | מזהה שורת DataStore              | int / number     | 0 / 0       | הושמט                                                                                                                                                    |
| `mispar_rechev`      | מספר רישוי                       | numeric / number | 0 / 0       | הושמט                                                                                                                                                    |
| `shilda`             | מספר שלדה                        | text / string    | 0 / 0       | הושמט                                                                                                                                                    |
| `tozeret_cd`         | קוד תוצר                         | numeric / number | 0 / 0       | 84 · `593`, `869`, `728`, `830`, `143`, `476`, `488`, `961`                                                                                              |
| `tozeret_nm`         | שם תוצר                          | text / string    | 0 / 0       | 84 · `"מרצדס בנץ גרמנ"`, `"קרייזלר ארהב\""`, `"פורד ארהב\""`, `"מרצדס בנץ ארהב"`, `"ב מ וו גרמניה"`, `"ימאהה יפן"`, `"טויוטה ארהב\""`, `"שברולט ארהב\""` |
| `sug_rechev_cd`      | קוד · סוג רכב                    | numeric / number | 0 / 0       | 19 · `112`, `10`, `344`, `871`, `113`, `111`, `341`, `464`                                                                                               |
| `sug_rechev_nm`      | סוג רכב                          | text / string    | 0 / 0       | 18 · `"פרטי נוסעים"`, `"אופנוע"`, `"מרכב אחוד מגורים"`, `"טרקטורון"`, `"פרטי נוסעים פתוח"`, `"מרכב אחוד"`, `"גרור סגור מגורים"`, `"משא פתוח"`            |
| `degem_nm`           | שם דגם                           | text / string    | 0 / 3       | 546 · `"R58N שירוקי גראנד"`, `"XXT"`, `"AM14Y"`, `"FIAT        280000"`, `"N15306-H3"`, `"X5"`, `"Y49S"`, `"VVLF"`                                       |
| `mishkal_kolel`      | משקל כולל לפי המקור              | numeric / number | 0 / 0       | 161 · `0`, `2800`, `1800`, `2000`, `3100`, `3000`, `3500`, `2830`                                                                                        |
| `shnat_yitzur`       | שנת ייצור                        | numeric / number | 0 / 0       | 66 · `2010`, `2009`, `2008`, `2014`, `2016`, `2011`, `2012`, `2019`                                                                                      |
| `nefach_manoa`       | נפח מנוע                         | numeric / number | 0 / 0       | 233 · `3498`, `0`, `2000`, `3604`, `3456`, `3700`, `3500`, `3600`                                                                                        |
| `tozeret_eretz_nm`   | ארץ תוצר                         | text / string    | 0 / 3       | 18 · `"ארהב\""`, `"גרמניה"`, `"יפן"`, `"בריטניה"`, `"איטליה"`, `"קנדה"`, `"ד. קוריאה"`, `"צרפת"`                                                         |
| `degem_manoa`        | דגם מנוע                         | text / string    | 0 / 9       | 375 · `"M272"`, `"2GR"`, `"M276"`, `"ERB"`, `"G"`, `"M308E"`, `"EM0027"`, `"2AZ"`                                                                        |
| `mivchan_acharon_dt` | טסט אחרון                        | text / string    | 0 / 0       | 235 · `"2026-11-18"`, `"2026-02-05"`, `"2026-09-24"`, `"2026-02-04"`, `"2026-09-16"`, `"2026-11-04"`, `"2026-10-08"`, `"2026-09-14"`                     |
| `tokef_dt`           | תוקף רישיון                      | text / string    | 0 / 0       | 203 · `"2027-01-31"`, `"2027-02-28"`, `"2027-09-30"`, `"2027-01-01"`, `"2026-12-31"`, `"2027-08-31"`, `"2027-04-30"`, `"2027-03-31"`                     |
| `sug_yevu`           | סוג יבוא                         | text / string    | 0 / 0       | 2 · `"יבוא אישי-משומש"`, `"יבוא אישי-חדש"`                                                                                                               |
| `moed_aliya_lakvish` | מועד עלייה לכביש בגרעיניות המקור | text / string    | 0 / 66      | 223 · `"2014-1"`, `"2009-9"`, `"1987-1"`, `"2012-1"`, `"2019-1"`, `"1989-1"`, `"2010-9"`, `"2018-1"`                                                     |
| `sug_delek_nm`       | סוג דלק                          | text / string    | 0 / 0       | 6 · `"בנזין"`, `"דיזל"`, `"גפמ\""`, `"חשמל/בנזין"`, `"חשמל"`, `"לא ידוע קוד 0"`                                                                          |

**JSON בפועל · 23/11/2026 12:59:41** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tozeret_cd": 961,
        "tozeret_nm": "שברולט ארהב\"",
        "sug_rechev_cd": 112,
        "sug_rechev_nm": "פרטי נוסעים",
        "degem_nm": "A2DW_קורבט",
        "mishkal_kolel": 0,
        "shnat_yitzur": 2011,
        "nefach_manoa": 6200,
        "tozeret_eretz_nm": "ארהב\"",
        "degem_manoa": "1WB",
        "mivchan_acharon_dt": "2026-11-18",
        "tokef_dt": "2027-03-31",
        "sug_yevu": "יבוא אישי-משומש",
        "moed_aliya_lakvish": "2011-3"
      },
      {
        "tozeret_cd": 593,
        "tozeret_nm": "מרצדס בנץ גרמנ",
        "sug_rechev_cd": 112,
        "sug_rechev_nm": "פרטי נוסעים",
        "degem_nm": "218373",
        "mishkal_kolel": 0,
        "shnat_yitzur": 2013,
        "nefach_manoa": 4663,
        "tozeret_eretz_nm": "גרמניה",
        "degem_manoa": "278922",
        "mivchan_acharon_dt": "2026-11-18",
        "tokef_dt": "2027-09-30",
        "sug_yevu": "יבוא אישי-משומש",
        "moed_aliya_lakvish": "2013-9"
      }
    ]
  }
}
```

<a id="resource-offroad_1"></a>

### `offRoad_1` · כלי רכב שירדו מהכביש ובסטטוס ביטול סופי

**הגדרת המפרסם בתמצית** · מפרט טכני ורישום ביטול סופי. למשאבי הארכיון תקופות המסומנות בשם. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/reshev_bitul_sofi)

**יצירת משאב לפי הקטלוג** · 2020-06-25.

**פרופיל חי** · 596 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                     | משמעות                                | DataStore / JSON       | null / רווח | ערכים נצפים                                                                                                                                                                                    |
| ----------------------- | ------------------------------------- | ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                   | מזהה שורת DataStore                   | int / number           | 0 / 0       | הושמט                                                                                                                                                                                          |
| `mispar_rechev`         | מספר רישוי                            | numeric / number       | 0 / 0       | הושמט                                                                                                                                                                                          |
| `tozeret_cd`            | קוד תוצר                              | numeric / number       | 0 / 0       | 93 · `281`, `286`, `676`, `588`, `839`, `603`, `751`, `778`                                                                                                                                    |
| `tozeret_nm`            | שם תוצר                               | text / string          | 0 / 0       | 93 · `"דייהטסו יפן"`, `"דאף אנגליה"`, `"סקודה צ'כיה"`, `"מזדה יפן"`, `"טויוטה טורקיה"`, `"מיצובישי תאילנ"`, `"שברולט ד.קוריא"`, `"סיאט ספרד"`                                                  |
| `degem_cd`              | קוד דגם                               | numeric / null, number | 225 / 0     | 136 · `52`, `661`, `431`, `9999`, `2`, `540`, `8`, `313`                                                                                                                                       |
| `degem_nm`              | שם דגם                                | text / string          | 0 / 2       | 291 · `"M301LS-GQGEW"`, `"BLA2Z"`, `"BL12Z"`, `"DYB"`, `"XTA03"`, `"TGF48"`, `"6Y5224"`, `"CM6SA"`                                                                                             |
| `sug_rechev_cd`         | קוד · סוג רכב                         | numeric / number       | 0 / 0       | 44 · `112`, `162`, `10`, `160`, `210`, `220`, `217`, `218`                                                                                                                                     |
| `sug_rechev_nm`         | סוג רכב                               | text / string          | 0 / 0       | 43 · `"פרטי נוסעים"`, `"פרטי נוסעים 5 דלתות"`, `"אופנוע"`, `"משא בלתי אחוד פתוח"`, `"משא קירור מבוקר דופן הידראולית"`, `"משא פתוח  דפן הידראולית"`, `"משא סגור  דפן הידראולית"`, `"מרכב אחוד"` |
| `moed_aliya_lakvish`    | מועד עלייה לכביש בגרעיניות המקור      | numeric / null, number | 277 / 0     | 16 · `2010`, `2011`, `2015`, `2014`, `2012`, `2016`, `2020`, `2021`                                                                                                                            |
| `bitul_dt`              | תאריך ביטול או אירוע סטטוס, לפי המאגר | text / string          | 0 / 0       | 463 · `"2026-11-19"`, `"2025-04-27"`, `"2025-04-24"`, `"2025-04-28"`, `"2025-04-30"`, `"2023-08-24"`, `"2022-12-08"`, `"2022-09-20"`                                                           |
| `misgeret`              | מספר שלדה                             | text / string          | 0 / 1       | הושמט                                                                                                                                                                                          |
| `tozar_manoa`           | תוצר מנוע                             | text / string          | 0 / 26      | 100 · `"דיהטסו"`, `"פולקסווגן"`, `"טויוטה"`, `"יפן מאזדה"`, `"קמינס"`, `"דאף"`, `"מיצובישי"`, `"ג.מ."`                                                                                         |
| `degem_manoa`           | דגם מנוע                              | text / string          | 0 / 25      | 205 · `"K3"`, `"Z6"`, `"3A92"`, `"ASY"`, `"2ZR"`, `"LV7"`, `"ALH"`, `"1ZR"`                                                                                                                    |
| `mispar_manoa`          | מספר מנוע                             | text / string          | 0 / 27      | הושמט                                                                                                                                                                                          |
| `mishkal_kolel`         | משקל כולל לפי המקור                   | numeric / number       | 0 / 0       | 153 · `0`, `1450`, `14990`, `1277`, `1420`, `1770`, `1370`, `18000`                                                                                                                            |
| `ramat_gimur`           | רמת גימור                             | text / string          | 0 / 246     | 85 · `"CX"`, `"ACTIVE"`, `"TREND"`, `"INSTYLE"`, `"AMBIENTE"`, `"CD"`, `"STELLA"`, `"TOUR"`                                                                                                    |
| `ramat_eivzur_betihuty` | רמת בטיחות                            | numeric / number       | 0 / 0       | 3 · `0`, `1`, `2`                                                                                                                                                                              |
| `kvutzat_zihum`         | קבוצת זיהום                           | numeric / number       | 0 / 0       | 13 · `0`, `15`, `14`, `3`, `4`, `10`, `13`, `9`                                                                                                                                                |
| `shnat_yitzur`          | שנת ייצור                             | numeric / number       | 0 / 0       | 54 · `2008`, `2010`, `2011`, `2004`, `2015`, `2014`, `2007`, `2012`                                                                                                                            |
| `baalut`                | בעלות נוכחית                          | text / string          | 0 / 0       | 2 · `"פרטי"`, `"חברה"`                                                                                                                                                                         |
| `tzeva_rechev`          | צבע                                   | text / string          | 0 / 0       | 33 · `"שנהב לבן"`, `"לא ידוע"`, `"כסף מטלי"`, `"אדום"`, `"אפור"`, `"כסף"`, `"כחול"`, `"בז מטאלי"`                                                                                              |
| `zmig_kidmi`            | מידות צמיג קדמי                       | text / string          | 0 / 5       | 173 · `"175/65R14"`, `"195/65R15"`, `"205/55R16"`, `"28570R19.5"`, `"185/55R15"`, `"165/65R14"`, `"195-65R15"`, `"185-60R14"`                                                                  |
| `zmig_ahori`            | מידות צמיג אחורי                      | text / string          | 0 / 148     | 123 · `"175/65R14"`, `"195/65R15"`, `"205/55R16"`, `"28570R19.5"`, `"185/55R15"`, `"165/65R14"`, `"195/60R15"`, `"31580R22.5"`                                                                 |
| `sug_delek_nm`          | סוג דלק                               | text / string          | 0 / 0       | 5 · `"בנזין"`, `"דיזל"`, `"לא ידוע קוד 0"`, `"גפמ\""`, `"חשמל"`                                                                                                                                |
| `horaat_rishum`         | קוד הוראת רישום                       | numeric / number       | 0 / 0       | 149 · `0`, `143279`, `200024`, `160192`, `133161`, `200363`, `201272`, `201107`                                                                                                                |
| `kinuy_mishari`         | כינוי מסחרי                           | text / string          | 0 / 242     | 83 · `".SIRION"`, `"OCTAVIA"`, `"MAZDA 3"`, `"FOCUS"`, `"SPARK"`, `"SPACE STAR"`, `"FABIA"`, `"SIRION"`                                                                                        |

**JSON בפועל · 23/11/2026 12:59:51** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tozeret_cd": 739,
        "tozeret_nm": "פיג'ו צרפת",
        "degem_cd": 5141,
        "degem_nm": "8D5FVA",
        "sug_rechev_cd": 112,
        "sug_rechev_nm": "פרטי נוסעים",
        "moed_aliya_lakvish": 2014,
        "bitul_dt": "2026-11-01",
        "tozar_manoa": "פיג'ו צרפת",
        "degem_manoa": "5F02",
        "mishkal_kolel": 2015,
        "ramat_gimur": "ACTIVE",
        "ramat_eivzur_betihuty": 0,
        "kvutzat_zihum": 15
      },
      {
        "tozeret_cd": 849,
        "tozeret_nm": "ג'יאנייו סין",
        "degem_cd": 9999,
        "degem_nm": "TML27",
        "sug_rechev_cd": 10,
        "sug_rechev_nm": "אופנוע",
        "moed_aliya_lakvish": 2020,
        "bitul_dt": "2026-01-19",
        "tozar_manoa": "גיאניו",
        "degem_manoa": "JN72V6000W",
        "mishkal_kolel": 0,
        "ramat_gimur": "",
        "ramat_eivzur_betihuty": 0,
        "kvutzat_zihum": 0
      }
    ]
  }
}
```

<a id="resource-offroad_2"></a>

### `offRoad_2` · כלי רכב שירדו מהכביש ובסטטוס ביטול סופי 2000-2009

**הגדרת המפרסם בתמצית** · מפרט טכני ורישום ביטול סופי. למשאבי הארכיון תקופות המסומנות בשם. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/reshev_bitul_sofi)

**יצירת משאב לפי הקטלוג** · 2023-05-02.

**פרופיל חי** · 206 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                     | משמעות                                | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                                                                                         |
| ----------------------- | ------------------------------------- | ---------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                   | מזהה שורת DataStore                   | int / number     | 0 / 0       | הושמט                                                                                                                                                                                               |
| `mispar_rechev`         | מספר רישוי                            | text / string    | 0 / 0       | הושמט                                                                                                                                                                                               |
| `tozeret_cd`            | קוד תוצר                              | text / string    | 0 / 0       | 33 · `"0590"`, `"0737"`, `"0724"`, `"0739"`, `"0603"`, `"0481"`, `"0650"`, `"0727"`                                                                                                                 |
| `tozeret_nm`            | שם תוצר                               | text / string    | 0 / 0       | 33 · `"מיצובישי יפן"`, `"פיאט איטליה"`, `"פולקסווגן גרמנ"`, `"פיג'ו צרפת"`, `"מיצובישי תאילנ"`, `"יונדאי קוריאה"`, `"סובארו יפן"`, `"פולקסווגן-ספרד"`                                               |
| `degem_cd`              | קוד דגם                               | text / string    | 0 / 138     | 30 · `"0271"`, `"0611"`, `"0720"`, `"0610"`, `"0000"`, `"0171"`, `"2420"`, `"0180"`                                                                                                                 |
| `degem_nm`              | שם דגם                                | text / string    | 0 / 0       | 93 · `"C12A CHAMP"`, `"CB4ASRJEQL6 לנסר"`, `"CB4ASNJEQL6 לנסר"`, `"1J2013"`, `"1H2213"`, `"316"`, `"VDSH"`, `"20AHD2"`                                                                              |
| `sug_rechev_cd`         | קוד · סוג רכב                         | text / string    | 0 / 0       | 11 · `"112"`, `"162"`, `"110"`, `"010"`, `"121"`, `"341"`, `"200"`, `"160"`, `"161"`, `"622"`, `"210"`                                                                                              |
| `sug_rechev_nm`         | סוג רכב                               | text / string    | 0 / 0       | 10 · `"פרטי נוסעים"`, `"פרטי נוסעים 5 דלתות"`, `"פרטי רגיל"`, `"אופנוע"`, `"מונית"`, `"מרכב אחוד"`, `"משא בלתי אחוד סגור"`, `"פרטי נוסעים 3 דלתות"`, `"אוטובוס זעיר צבורי"`, `"משא בלתי אחוד פתוח"` |
| `moed_aliya_lakvish`    | מועד עלייה לכביש בגרעיניות המקור      | text / string    | 0 / 203     | 2 · `"2008"`, `"2009"`                                                                                                                                                                              |
| `bitul_dt`              | תאריך ביטול או אירוע סטטוס, לפי המאגר | text / string    | 0 / 0       | 195 · `"2008-11-16"`, `"2005-09-15"`, `"2003-05-28"`, `"2008-05-19"`, `"2006-04-27"`, `"2005-03-06"`, `"2009-05-05"`, `"2005-02-14"`                                                                |
| `misgeret`              | מספר שלדה                             | text / string    | 0 / 0       | הושמט                                                                                                                                                                                               |
| `tozar_manoa`           | תוצר מנוע                             | text / string    | 0 / 0       | 44 · `"פולקסווגן"`, `"מיצובישי יפן"`, `"פיג'ו"`, `"מיצובישי תיאלנד"`, `"יונדאי"`, `"סיטרואן"`, `"פוג'י"`, `"פיאט איטליה"`                                                                           |
| `degem_manoa`           | דגם מנוע                              | text / string    | 0 / 0       | 85 · `"4G92"`, `"AGP"`, `"4G15E"`, `"G4EK"`, `"AFN"`, `"EJ 16"`, `"AGR"`, `"AEY"`                                                                                                                   |
| `mispar_manoa`          | מספר מנוע                             | text / string    | 0 / 0       | הושמט                                                                                                                                                                                               |
| `mishkal_kolel`         | משקל כולל לפי המקור                   | text / string    | 0 / 0       | 39 · `"0"`, `"1420"`, `"1220"`, `"1200"`, `"1465"`, `"1660"`, `"1840"`, `"2"`                                                                                                                       |
| `ramat_gimur`           | רמת גימור                             | text / string    | 0 / 164     | 15 · `"SDI"`, `"BASIC"`, `"STELLA"`, `"LX"`, `"GLX"`, `"COMFORTLINE"`, `"SIGNO"`, `"TRENDY"`                                                                                                        |
| `ramat_eivzur_betihuty` | רמת בטיחות                            | text / string    | 0 / 0       | 1 · `"0"`                                                                                                                                                                                           |
| `kvutzat_zihum`         | קבוצת זיהום                           | text / string    | 0 / 0       | 2 · `"0"`, `"15"`                                                                                                                                                                                   |
| `shnat_yitzur`          | שנת ייצור                             | text / string    | 0 / 0       | 27 · `"1994"`, `"1995"`, `"1998"`, `"2001"`, `"1989"`, `"1993"`, `"1987"`, `"1997"`                                                                                                                 |
| `baalut`                | בעלות נוכחית                          | text / string    | 0 / 0       | 2 · `"פרטי"`, `"חברה"`                                                                                                                                                                              |
| `tzeva_rechev`          | צבע                                   | text / string    | 0 / 0       | 24 · `"שנהב לבן"`, `"כסף"`, `"כחול"`, `"ירוק מטל"`, `" לא ידוע"`, `"אפור"`, `"שחור"`, `"כסף מטלי"`                                                                                                  |
| `zmig_kidmi`            | מידות צמיג קדמי                       | text / string    | 0 / 0       | 70 · `"175/70R13"`, `"185/60 R14"`, `"195/65 R15"`, `"185-60R14"`, `"175/65R14"`, `"165/70R13"`, `"155R13"`, `"165-13"`                                                                             |
| `zmig_ahori`            | מידות צמיג אחורי                      | text / string    | 0 / 69      | 46 · `"175/70R13"`, `"195/65 R15"`, `"185/60 R14"`, `"130/70-12"`, `"185/70R/14"`, `"175/65R14"`, `"165/70R13"`, `"135-13"`                                                                         |
| `sug_delek_nm`          | סוג דלק                               | text / string    | 0 / 0       | 2 · `"בנזין"`, `"דיזל"`                                                                                                                                                                             |
| `horaat_rishum`         | קוד הוראת רישום                       | text / string    | 0 / 0       | 8 · `"0"`, `"70603"`, `"90056"`, `"70529"`, `"61756"`, `"61585"`, `"70364"`, `"61385"`                                                                                                              |
| `kinuy_mishari`         | כינוי מסחרי                           | text / string    | 0 / 143     | 26 · `"POLO CLASSIC"`, `"BORA"`, `"ונטו 0091 4דלת' אוטו"`, `"CORDOBA"`, `"IMPREZA"`, `"פיאט פונטו 57 DSH  G"`, `"אפלאוז IL רגיל"`, `"PASSAT"`                                                       |

**JSON בפועל · 23/11/2026 13:00:05** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tozeret_cd": "0778",
        "tozeret_nm": "סיאט ספרד",
        "degem_cd": "0180",
        "degem_nm": "6K22K6",
        "sug_rechev_cd": "112",
        "sug_rechev_nm": "פרטי נוסעים",
        "moed_aliya_lakvish": "",
        "bitul_dt": "2009-06-30",
        "tozar_manoa": "פולקסווגן",
        "degem_manoa": "AGP",
        "mishkal_kolel": "0",
        "ramat_gimur": "STELLA",
        "ramat_eivzur_betihuty": "0",
        "kvutzat_zihum": "0"
      },
      {
        "tozeret_cd": "0727",
        "tozeret_nm": "פולקסווגן-ספרד",
        "degem_cd": "0610",
        "degem_nm": "קלאסיק פולו_6V20Z2",
        "sug_rechev_cd": "112",
        "sug_rechev_nm": "פרטי נוסעים",
        "moed_aliya_lakvish": "",
        "bitul_dt": "2009-11-29",
        "tozar_manoa": "פולקסווגן",
        "degem_manoa": "AEY",
        "mishkal_kolel": "0",
        "ramat_gimur": "SDI",
        "ramat_eivzur_betihuty": "0",
        "kvutzat_zihum": "0"
      }
    ]
  }
}
```

<a id="resource-offroad_3"></a>

### `offRoad_3` · כלי רכב שירדו מהכביש ובסטטוס ביטול סופי 2010-2016

**הגדרת המפרסם בתמצית** · מפרט טכני ורישום ביטול סופי. למשאבי הארכיון תקופות המסומנות בשם. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/reshev_bitul_sofi)

**יצירת משאב לפי הקטלוג** · 2021-10-28.

**פרופיל חי** · 206 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                     | משמעות                                | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_id`                   | מזהה שורת DataStore                   | int / number     | 0 / 0       | הושמט                                                                                                                                                                                                                          |
| `mispar_rechev`         | מספר רישוי                            | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                          |
| `tozeret_cd`            | קוד תוצר                              | text / string    | 0 / 0       | 40 · `"0281"`, `"0739"`, `"0650"`, `"0496"`, `"0481"`, `"0817"`, `"0588"`, `"0962"`                                                                                                                                            |
| `tozeret_nm`            | שם תוצר                               | text / string    | 0 / 0       | 40 · `"דייהטסו-יפן"`, `"פיג'ו צרפת"`, `"סובארו יפן"`, `"סיטרואן ספרד"`, `"יונדאי קוריאה"`, `"סיטרואן צרפת"`, `"מזדה יפן"`, `"שברולט קנדה"`                                                                                     |
| `degem_cd`              | קוד דגם                               | text / string    | 0 / 60      | 72 · `"0331"`, `"0450"`, `"1261"`, `"3000"`, `"0361"`, `"0081"`, `"0101"`, `"0431"`                                                                                                                                            |
| `degem_nm`              | שם דגם                                | text / string    | 0 / 0       | 115 · `"GJWJYB"`, `"VA21N אקסנט"`, `"4BLFZ4"`, `"BERLINGO X MFWJYB"`, `"AC 2"`, `"CM41A"`, `"LANTIS GLX BA126"`, `"000 גי 11"`                                                                                                 |
| `sug_rechev_cd`         | קוד · סוג רכב                         | text / string    | 0 / 0       | 12 · `"112"`, `"162"`, `"341"`, `"160"`, `"161"`, `"110"`, `"212"`, `"200"`, `"113"`, `"140"`, `"111"`, `"201"`                                                                                                                |
| `sug_rechev_nm`         | סוג רכב                               | text / string    | 0 / 0       | 10 · `"פרטי נוסעים"`, `"פרטי נוסעים 5 דלתות"`, `"מרכב אחוד"`, `"פרטי נוסעים 3 דלתות"`, `"פרטי רגיל"`, `"משא ב.אחוד פתוח-תא כפול"`, `"משא בלתי אחוד סגור"`, `"פרטי נוסעים פתוח"`, `"פרטי רכב שדה"`, `"משא ב.אחוד סגור-תא כפול"` |
| `moed_aliya_lakvish`    | מועד עלייה לכביש בגרעיניות המקור      | text / string    | 0 / 176     | 5 · `"2010"`, `"2011"`, `"2012"`, `"2008"`, `"2009"`                                                                                                                                                                           |
| `bitul_dt`              | תאריך ביטול או אירוע סטטוס, לפי המאגר | text / string    | 0 / 0       | 198 · `"2010-01-21"`, `"2014-08-24"`, `"2013-02-05"`, `"2011-09-11"`, `"2011-07-21"`, `"2012-01-26"`, `"2012-10-05"`, `"2013-08-01"`                                                                                           |
| `misgeret`              | מספר שלדה                             | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                          |
| `tozar_manoa`           | תוצר מנוע                             | text / string    | 0 / 0       | 39 · `"יונדאי"`, `"פיג'ו"`, `"סיטרואן ספרד"`, `"פוג'י"`, `"דיהטסו"`, `"דייהטסו"`, `"סיטרואן"`, `"יפן מאזדה"`                                                                                                                   |
| `degem_manoa`           | דגם מנוע                              | text / string    | 0 / 1       | 98 · `"WJY"`, `"CB"`, `"G4EK"`, `"EJ 16"`, `"LFZ"`, `"EA 71"`, `"G4EE"`, `"B6"`                                                                                                                                                |
| `mispar_manoa`          | מספר מנוע                             | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                          |
| `mishkal_kolel`         | משקל כולל לפי המקור                   | text / string    | 0 / 0       | 60 · `"0"`, `"1840"`, `"1050"`, `"1440"`, `"1620"`, `"1200"`, `"1600"`, `"1660"`                                                                                                                                               |
| `ramat_gimur`           | רמת גימור                             | text / string    | 0 / 114     | 25 · `"X"`, `"INSPIRE"`, `"GL"`, `"CLASSIC"`, `"LX"`, `"LS"`, `"CZ"`, `"GLS"`                                                                                                                                                  |
| `ramat_eivzur_betihuty` | רמת בטיחות                            | text / string    | 0 / 0       | 1 · `"0"`                                                                                                                                                                                                                      |
| `kvutzat_zihum`         | קבוצת זיהום                           | text / string    | 0 / 0       | 7 · `"0"`, `"15"`, `"14"`, `"13"`, `"10"`, `"5"`, `"4"`                                                                                                                                                                        |
| `shnat_yitzur`          | שנת ייצור                             | text / string    | 0 / 0       | 28 · `"1998"`, `"1997"`, `"2000"`, `"1996"`, `"1994"`, `"2010"`, `"2011"`, `"2002"`                                                                                                                                            |
| `baalut`                | בעלות נוכחית                          | text / string    | 0 / 0       | 3 · `"פרטי"`, `"ליסינג"`, `"חברה"`                                                                                                                                                                                             |
| `tzeva_rechev`          | צבע                                   | text / string    | 0 / 0       | 25 · `"שנהב לבן"`, `"כסף"`, `"בז"`, `"אדום"`, `"שחור"`, `"אפור"`, `"כחול מטל"`, `"ירוק מטל"`                                                                                                                                   |
| `zmig_kidmi`            | מידות צמיג קדמי                       | text / string    | 0 / 0       | 67 · `"185/65R14"`, `"175/70R14"`, `"175/65R14"`, `"175/70R13"`, `"165/70R13"`, `"155-13"`, `"P225/60R16"`, `"145/70R13"`                                                                                                      |
| `zmig_ahori`            | מידות צמיג אחורי                      | text / string    | 0 / 51      | 52 · `"175/70R14"`, `"175/65R14"`, `"175/70R13"`, `"165/70R13"`, `"155-13"`, `"P225/60R16"`, `"185/65R14"`, `"P215/60R15"`                                                                                                     |
| `sug_delek_nm`          | סוג דלק                               | text / string    | 0 / 0       | 2 · `"בנזין"`, `"דיזל"`                                                                                                                                                                                                        |
| `horaat_rishum`         | קוד הוראת רישום                       | text / string    | 0 / 0       | 1 · `"0"`                                                                                                                                                                                                                      |
| `kinuy_mishari`         | כינוי מסחרי                           | text / string    | 0 / 60      | 63 · `"BERLINGO"`, `"ACCENT"`, `"מזדה לנטיס אוטומט_32"`, `"SIRION"`, `"I30"`, `"סובארו גרנד ליאונה 6"`, `"C220 CDI"`, `"שריידISC-אוט'5 דלתות"`                                                                                 |

**JSON בפועל · 23/11/2026 13:00:15** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tozeret_cd": "0588",
        "tozeret_nm": "מזדה יפן",
        "degem_cd": "",
        "degem_nm": "MPV-LV12J",
        "sug_rechev_cd": "341",
        "sug_rechev_nm": "מרכב אחוד",
        "moed_aliya_lakvish": "",
        "bitul_dt": "2015-02-01",
        "tozar_manoa": "יפן מאזדה",
        "degem_manoa": "JE",
        "mishkal_kolel": "2340",
        "ramat_gimur": "",
        "ramat_eivzur_betihuty": "0",
        "kvutzat_zihum": "0"
      },
      {
        "tozeret_cd": "0817",
        "tozeret_nm": "סיטרואן צרפת",
        "degem_cd": "",
        "degem_nm": "MFD9BE",
        "sug_rechev_cd": "341",
        "sug_rechev_nm": "מרכב אחוד",
        "moed_aliya_lakvish": "",
        "bitul_dt": "2012-08-23",
        "tozar_manoa": "סיטרואן",
        "degem_manoa": "D9B",
        "mishkal_kolel": "1840",
        "ramat_gimur": "",
        "ramat_eivzur_betihuty": "0",
        "kvutzat_zihum": "0"
      }
    ]
  }
}
```

<a id="resource-frozen_with_model"></a>

### `frozen_with_model` · מספרי רישוי של כלי רכב לא פעילים עם קוד דגם

**הגדרת המפרסם בתמצית** · עם קוד דגם. תיאור המאגר מציין חוסר תוקף 13 חודשים אחורה, ומחריג רכבים גנובים וביטול סופי; מתעדכן יומית. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/rechev_le_pail_with_degem)

**יצירת משאב לפי הקטלוג** · 2021-05-11.

**פרופיל חי** · 566 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                     | משמעות                           | DataStore / JSON       | null / רווח | ערכים נצפים                                                                                                                                 |
| ----------------------- | -------------------------------- | ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                   | מזהה שורת DataStore              | int / number           | 0 / 0       | הושמט                                                                                                                                       |
| `mispar_rechev`         | מספר רישוי                       | numeric / number       | 0 / 0       | הושמט                                                                                                                                       |
| `tozeret_cd`            | קוד תוצר                         | numeric / number       | 0 / 0       | 64 · `481`, `588`, `928`, `177`, `751`, `940`, `817`, `156`                                                                                 |
| `sug_degem`             | סוג דגם                          | text / string          | 0 / 0       | 2 · `"P"`, `"M"`                                                                                                                            |
| `tozeret_nm`            | שם תוצר                          | text / string          | 0 / 0       | 64 · `"יונדאי ד. קורי"`, `"מזדה יפן"`, `"רנו צרפת"`, `"פיאט טורקיה"`, `"שברולט ד.קוריא"`, `"רנו ספרד"`, `"סיטרואן צרפת"`, `"ביואיק ארהב\""` |
| `degem_cd`              | קוד דגם                          | numeric / number       | 0 / 0       | 220 · `75`, `211`, `21`, `18`, `191`, `17`, `271`, `601`                                                                                    |
| `degem_nm`              | שם דגם                           | text / string          | 0 / 0       | 255 · `"KC0EDF KAN RT 1.9D"`, `"BT51H"`, `"4HP69"`, `"BJ12M"`, `"225AXD11-05C"`, `"G4EK ACCENT VA21N"`, `"PJ5EE"`, `"225AXD1A-04B"`         |
| `ramat_gimur`           | רמת גימור                        | text / string          | 0 / 78      | 113 · `"ACTIVE"`, `"GLX"`, `"GL"`, `"LS"`, `"RT"`, `"GLS"`, `"LX"`, `"EXECUTIVE"`                                                           |
| `ramat_eivzur_betihuty` | רמת בטיחות                       | numeric / null, number | 563 / 0     | 1 · `1`                                                                                                                                     |
| `kvutzat_zihum`         | קבוצת זיהום                      | numeric / null, number | 385 / 0     | 4 · `15`, `14`, `7`, `8`                                                                                                                    |
| `shnat_yitzur`          | שנת ייצור                        | numeric / number       | 0 / 0       | 23 · `1999`, `2008`, `2004`, `2005`, `2003`, `2013`, `2009`, `2001`                                                                         |
| `degem_manoa`           | דגם מנוע                         | text / string          | 0 / 0       | 177 · `"F8Q"`, `"G4EA"`, `"199A9000"`, `"ZM"`, `"K7M"`, `"K4M"`, `"G4EK"`, `"F16D4"`                                                        |
| `mivchan_acharon_dt`    | טסט אחרון                        | text / string          | 0 / 0       | 530 · `"2020-06-11"`, `"2019-12-29"`, `"2002-12-15"`, `"2019-07-25"`, `"2024-03-27"`, `"2024-11-11"`, `"2020-07-09"`, `"2019-04-03"`        |
| `tokef_dt`              | תוקף רישיון                      | text / string          | 0 / 0       | 491 · `"2025-06-26"`, `"2021-07-28"`, `"2016-03-29"`, `"2019-03-29"`, `"2025-01-25"`, `"2025-01-22"`, `"2025-01-29"`, `"2015-08-22"`        |
| `baalut`                | בעלות נוכחית                     | text / string          | 0 / 0       | 3 · `"פרטי"`, `"סוחר"`, `"חברה"`                                                                                                            |
| `misgeret`              | מספר שלדה                        | text / string          | 0 / 0       | הושמט                                                                                                                                       |
| `tzeva_cd`              | קוד · צבע                        | numeric / number       | 0 / 0       | 51 · `80`, `25`, `29`, `20`, `66`, `10`, `27`, `36`                                                                                         |
| `tzeva_rechev`          | צבע                              | text / string          | 0 / 0       | 51 · `"שנהב לבן"`, `"כסף"`, `"כסף מטלי"`, `"אפור"`, `"בז"`, `"שחור"`, `"אפור מטל"`, `"כחול מטל"`                                            |
| `zmig_kidmi`            | מידות צמיג קדמי                  | text / string          | 0 / 0       | 155 · `"175/65R14"`, `"185/65R14"`, `"185/65R15"`, `"175/70R13"`, `"165/70R13"`, `"195/65R15"`, `"205/55R16"`, `"195/60R15"`                |
| `zmig_ahori`            | מידות צמיג אחורי                 | text / string          | 0 / 56      | 143 · `"175/65R14"`, `"185/65R15"`, `"175/70R13"`, `"185/65R14"`, `"165/70R13"`, `"195/60R15"`, `"195/65R15"`, `"205/55R16"`                |
| `sug_delek_nm`          | סוג דלק                          | text / string          | 0 / 0       | 3 · `"בנזין"`, `"דיזל"`, `"גפמ\""`                                                                                                          |
| `horaat_rishum`         | קוד הוראת רישום                  | numeric / null, number | 492 / 0     | 38 · `130083`, `121823`, `122426`, `130157`, `122230`, `130401`, `140016`, `120046`                                                         |
| `moed_aliya_lakvish`    | מועד עלייה לכביש בגרעיניות המקור | text / string          | 0 / 410     | 58 · `"2013-7"`, `"2009-7"`, `"2008-7"`, `"2012-7"`, `"2009-11"`, `"2013-8"`, `"2011-3"`, `"2009-1"`                                        |
| `kinuy_mishari`         | כינוי מסחרי                      | text / string          | 0 / 0       | 180 · `"QUBO"`, `"KANGOO"`, `"GETZ"`, `"BERLINGO"`, `"LANTIS 323"`, `"ASTRA"`, `"CIVIC"`, `"CRUZE 1.6 LS"`                                  |

**JSON בפועל · 23/11/2026 13:00:24** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tozeret_cd": 413,
        "sug_degem": "P",
        "tozeret_nm": "טויוטה יפן",
        "degem_cd": 501,
        "degem_nm": "ZZE121L-AEPDKW",
        "ramat_gimur": "SUN",
        "ramat_eivzur_betihuty": null,
        "kvutzat_zihum": null,
        "shnat_yitzur": 2006,
        "degem_manoa": "3ZZ",
        "mivchan_acharon_dt": "2023-05-03",
        "tokef_dt": "2023-12-17",
        "baalut": "פרטי",
        "tzeva_cd": 80
      },
      {
        "tozeret_cd": 413,
        "sug_degem": "P",
        "tozeret_nm": "טויוטה יפן",
        "degem_cd": 481,
        "degem_nm": "ACV30L-AEPNKW",
        "ramat_gimur": "EXECUTIVE",
        "ramat_eivzur_betihuty": null,
        "kvutzat_zihum": null,
        "shnat_yitzur": 2006,
        "degem_manoa": "2AZ",
        "mivchan_acharon_dt": "2019-03-10",
        "tokef_dt": "2019-12-07",
        "baalut": "פרטי",
        "tzeva_cd": 44
      }
    ]
  }
}
```

<a id="resource-frozen_no_model"></a>

### `frozen_no_model` · מספרי רישוי של כלי רכב לא פעילים וחסרי קוד דגם

**הגדרת המפרסם בתמצית** · ללא קוד דגם. תיאור המאגר מציין חוסר תוקף 13 חודשים אחורה, ומחריג רכבים גנובים וביטול סופי; מתעדכן יומית. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/rechev_le_pail_without-degem)

**יצירת משאב לפי הקטלוג** · 2021-05-13.

**פרופיל חי** · 346 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                    | משמעות                             | DataStore / JSON       | null / רווח | ערכים נצפים                                                                                              |
| ---------------------- | ---------------------------------- | ---------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `_id`                  | מזהה שורת DataStore                | int / number           | 0 / 0       | הושמט                                                                                                    |
| `mispar_rechev`        | מספר רישוי                         | numeric / number       | 0 / 0       | הושמט                                                                                                    |
| `mispar_shilda`        | מספר שלדה                          | text / string          | 0 / 47      | הושמט                                                                                                    |
| `tkina_EU`             | סיווג תקינה אירופית                | text / string          | 0 / 0       | 7 · `"L2"`, `"M1"`, `"N1"`, `"N2"`, `"N3"`, `"L1"`, `"T2"`                                               |
| `shnat_yitzur`         | שנת ייצור                          | numeric / number       | 0 / 0       | 56 · `1982`, `1997`, `1983`, `1964`, `1973`, `1974`, `1972`, `1963`                                      |
| `tozeret_cd`           | קוד תוצר                           | numeric / number       | 0 / 0       | 30 · `739`, `361`, `312`, `728`, `151`, `736`, `730`, `281`                                              |
| `tozeret_nm`           | שם תוצר                            | text / string          | 0 / 4       | 26 · `"פיג'ו"`, `"וולבו"`, `"פורד"`, `"הונדה"`, `"אלון"`, `"פיאג'"`, `"דייהט"`, `"דודג'"`                |
| `tozeret_eretz_nm`     | ארץ תוצר                           | text / string          | 0 / 4       | 9 · `"צרפת"`, `"ארהב\""`, `"יפן"`, `"שבדיה"`, `"גרמניה"`, `"ישראל"`, `"איטליה"`, `"בריטניה"`, `"מקסיקו"` |
| `sug_delek_cd`         | קוד סוג דלק                        | numeric / number       | 0 / 0       | 3 · `1`, `2`, `7`                                                                                        |
| `sug_delek_nm`         | סוג דלק                            | text / string          | 0 / 0       | 3 · `"בנזין"`, `"דיזל"`, `"חשמל/בנזין"`                                                                  |
| `mishkal_kolel`        | משקל כולל לפי המקור                | numeric / number       | 0 / 0       | 28 · `0`, `2425`, `2515`, `4000`, `2200`, `1050`, `18000`, `2100`                                        |
| `degem_nm`             | שם דגם                             | text / string          | 0 / 47      | 104 · `"144"`, `"CH-250 R"`, `"504צ01"`, `"קורטינה"`, `"1400"`, `"וספה"`, `"504-צ51"`, `"504-צ01"`       |
| `mishkal_azmi`         | משקל עצמי לפי המקור                | numeric / number       | 0 / 0       | 18 · `0`, `1440`, `1450`, `1490`, `1520`, `1280`, `1410`, `1340`                                         |
| `nefach_manoa`         | נפח מנוע                           | numeric / number       | 0 / 0       | 40 · `0`, `1986`, `150`, `244`, `993`, `1593`, `148`, `249`                                              |
| `degem_manoa`          | דגם מנוע                           | text / string          | 0 / 50      | 104 · `"MF-03-E"`, `"*C7"`, `"XM7TR"`, `"20"`, `"150"`, `"2000"`, `"CB"`, `"B20"`                        |
| `hanaa_cd`             | קוד · הנעה                         | text / string          | 0 / 0       | 6 · `"1"`, `"Z"`, `"0"`, `"3"`, `"2"`, `"4"`                                                             |
| `hanaa_nm`             | הנעה                               | text / string          | 0 / 0       | 6 · `"4X2"`, `"לא ידוע"`, `"חסר הנעה"`, `"4X4"`, `"6X2"`, `"6X4"`                                        |
| `mishkal_mitan_harama` | משקל מטען להרמה, יחידה טעונה אימות | numeric / number       | 0 / 0       | 61 · `0`, `1375`, `1285`, `700`, `600`, `1300`, `1400`, `1500`                                           |
| `horaat_rishum`        | קוד הוראת רישום                    | numeric / null, number | 344 / 0     | 2 · `80331`, `107222`                                                                                    |

**JSON בפועל · 23/11/2026 13:00:33** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tkina_EU": "M1",
        "shnat_yitzur": 1967,
        "tozeret_cd": 728,
        "tozeret_nm": "פורד",
        "tozeret_eretz_nm": "ארהב\"",
        "sug_delek_cd": 1,
        "sug_delek_nm": "בנזין",
        "mishkal_kolel": 0,
        "degem_nm": "86",
        "mishkal_azmi": 0,
        "nefach_manoa": 7570,
        "degem_manoa": "YG7",
        "hanaa_cd": "1",
        "hanaa_nm": "4X2"
      },
      {
        "tkina_EU": "M1",
        "shnat_yitzur": 1993,
        "tozeret_cd": 143,
        "tozeret_nm": "ב מ ו",
        "tozeret_eretz_nm": "גרמניה",
        "sug_delek_cd": 1,
        "sug_delek_nm": "בנזין",
        "mishkal_kolel": 0,
        "degem_nm": "316\\I A (CA21)",
        "mishkal_azmi": 0,
        "nefach_manoa": 1596,
        "degem_manoa": "16 4E 1",
        "hanaa_cd": "1",
        "hanaa_nm": "4X2"
      }
    ]
  }
}
```

<a id="resource-heavy"></a>

### `heavy` · מאגר כלי רכב מעל 3 וחצי טון וכלי רכב חסרי קוד דגם

**הגדרת המפרסם בתמצית** · כלים פעילים כבדים ו/או חסרי קוד דגם. בין הסוגים המפורטים בקטלוג גרור נתמך, טרקטור, רכב עבודה, משא ואוטובוס. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/heavy-truck)

**יצירת משאב לפי הקטלוג** · 2020-02-20.

**פרופיל חי** · 706 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                         | משמעות                             | DataStore / JSON       | null / רווח | ערכים נצפים                                                                                                                                   |
| --------------------------- | ---------------------------------- | ---------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                       | מזהה שורת DataStore                | int / number           | 0 / 0       | הושמט                                                                                                                                         |
| `mispar_rechev`             | מספר רישוי                         | numeric / number       | 0 / 0       | הושמט                                                                                                                                         |
| `mispar_shilda`             | מספר שלדה                          | text / string          | 0 / 0       | הושמט                                                                                                                                         |
| `tkina_EU`                  | סיווג תקינה אירופית                | text / string          | 0 / 0       | 12 · `"N2"`, `"O1"`, `"T1"`, `"M2"`, `"T2"`, `"O2"`, `"O4"`, `"M3"`, `"N3"`, `"M1"`, `"N1"`, `"O3"`                                           |
| `shnat_yitzur`              | שנת ייצור                          | numeric / number       | 0 / 0       | 60 · `2022`, `2023`, `2026`, `2008`, `2017`, `2024`, `2015`, `2013`                                                                           |
| `tozeret_cd`                | קוד תוצר                           | numeric / number       | 0 / 0       | 94 · `593`, `127`, `168`, `786`, `539`, `701`, `46`, `446`                                                                                    |
| `tozeret_nm`                | שם תוצר                            | text / string          | 0 / 0       | 94 · `"מרצדס בנץ גרמנ"`, `"איסוזו יפן"`, `"פולאריס פולין"`, `"פולריס ארהב\""`, `"מרכבי נוע בעמ"`, `"עצמי"`, `"אקסס טאיוואן"`, `"אוובוס ספרד"` |
| `tozeret_eretz_nm`          | ארץ תוצר                           | text / string          | 0 / 0       | 19 · `"גרמניה"`, `"ישראל"`, `"ארהב\""`, `"פולין"`, `"יפן"`, `"ספרד"`, `"טאיוואן"`, `"בריטניה"`                                                |
| `sug_delek_cd`              | קוד סוג דלק                        | text / string          | 0 / 218     | 2 · `"2"`, `"1"`                                                                                                                              |
| `sug_delek_nm`              | סוג דלק                            | text / string          | 0 / 218     | 2 · `"דיזל"`, `"בנזין"`                                                                                                                       |
| `mishkal_kolel`             | משקל כולל לפי המקור                | numeric / number       | 0 / 0       | 107 · `5000`, `750`, `500`, `0`, `1356`, `1250`, `11990`, `40000`                                                                             |
| `mishkal_azmi`              | משקל עצמי לפי המקור                | numeric / number       | 0 / 0       | 297 · `0`, `539`, `2620`, `250`, `150`, `460`, `3485`, `763`                                                                                  |
| `degem_nm`                  | שם דגם                             | text / string          | 0 / 0       | 274 · `"SPRINTER 907.657"`, `"RRE99"`, `"SPRINTER 907.253"`, `"NPR75"`, `"519CDI 906.657"`, `"OC500RF"`, `"SNARLER 600GL"`, `"HH50A"`         |
| `nefach_manoa`              | נפח מנוע                           | numeric / number       | 0 / 0       | 74 · `0`, `2987`, `1950`, `5193`, `10677`, `999`, `499`, `10518`                                                                              |
| `degem_manoa`               | דגם מנוע                           | text / string          | 0 / 218     | 115 · `"OM642"`, `"OM654"`, `"4HK1"`, `"OM470LA.6-2"`, `"199MS"`, `"EH500PLE225"`, `"1206231"`, `"OM936LA.6GE-05-00"`                         |
| `hanaa_cd`                  | קוד · הנעה                         | text / string          | 0 / 0       | 8 · `"1"`, `"Z"`, `"3"`, `"2"`, `"A"`, `"0"`, `"H"`, `"4"`                                                                                    |
| `hanaa_nm`                  | הנעה                               | text / string          | 0 / 0       | 8 · `"4X2"`, `"לא ידוע"`, `"4X4"`, `"6X2"`, `"8X4"`, `"חסר הנעה"`, `"12X8"`, `"6X4"`                                                          |
| `mishkal_mitan_harama`      | משקל מטען להרמה, יחידה טעונה אימות | numeric / number       | 0 / 0       | 306 · `0`, `2380`, `682`, `1515`, `350`, `500`, `208`, `593`                                                                                  |
| `moed_aliya_lakvish`        | מועד עלייה לכביש בגרעיניות המקור   | text / string          | 0 / 135     | 81 · `"2022-6"`, `"2023-1"`, `"2024-1"`, `"2026-7"`, `"2022-9"`, `"2020-9"`, `"2022-5"`, `"2016-5"`                                           |
| `horaat_rishum`             | קוד הוראת רישום                    | numeric / null, number | 114 / 0     | 229 · `223090`, `203210`, `203097`, `253164`, `239016`, `225062`, `71251`, `209084`                                                           |
| `mispar_mekomot_leyd_nahag` | מספר מקומות ליד הנהג               | numeric / number       | 0 / 0       | 3 · `0`, `2`, `1`                                                                                                                             |
| `mispar_mekomot`            | מספר מקומות לפי הגדרת המקור        | numeric / null, number | 489 / 0     | 21 · `19`, `4`, `1`, `34`, `55`, `0`, `15`, `16`                                                                                              |
| `kvutzat_sug_rechev`        | קבוצת סוג רכב                      | text / string          | 0 / 0       | 7 · `"גרור נתמך"`, `"טרקטור"`, `"משא"`, `"אוטובוס"`, `"מסחרי"`, `"פרטי"`, `"רכב עבודה"`                                                       |
| `grira_nm`                  | תיאור גרירה                        | text / string          | 0 / 0       | 3 · `"אין וו גרירה"`, `"וו גרירה קבוע"`, `"יש וו גרירה"`                                                                                      |
| `zmig_kidmi`                | מידות צמיג קדמי                    | text / string          | 0 / 34      | 175 · `"195/75R16C"`, `"205/75R16C"`, `"155X80X13"`, `"25X10X12"`, `"275/70R22.5"`, `"21575R175"`, `"315/80R22.5"`, `"26X8-14"`               |
| `zmig_ahori`                | מידות צמיג אחורי                   | text / string          | 0 / 180     | 124 · `"195/75R16C"`, `"205/75R16C"`, `"25X11X12"`, `"275/70R22.5"`, `"21575R175"`, `"315/80R22.5"`, `"26X10-14"`, `"235/65R16C"`             |
| `mispar_manoa`              | מספר מנוע                          | text / string          | 0 / 218     | הושמט                                                                                                                                         |
| `sranim`                    | מספר סרנים לפי שם השדה             | numeric / number       | 0 / 0       | 182 · `432`, `0`, `366`, `2060`, `1450`, `4480`, `6780`, `250`                                                                                |

**JSON בפועל · 23/11/2026 13:00:45** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tkina_EU": "N1",
        "shnat_yitzur": 1955,
        "tozeret_cd": 961,
        "tozeret_nm": "שברולט ארהב\"",
        "tozeret_eretz_nm": "ארהב\"",
        "sug_delek_cd": "1",
        "sug_delek_nm": "בנזין",
        "mishkal_kolel": 2300,
        "mishkal_azmi": 1610,
        "degem_nm": "3104",
        "nefach_manoa": 0,
        "degem_manoa": "A59T",
        "hanaa_cd": "1",
        "hanaa_nm": "4X2"
      },
      {
        "tkina_EU": "N1",
        "shnat_yitzur": 1951,
        "tozeret_cd": 728,
        "tozeret_nm": "פורד ארהב\"",
        "tozeret_eretz_nm": "ארהב\"",
        "sug_delek_cd": "1",
        "sug_delek_nm": "בנזין",
        "mishkal_kolel": 2150,
        "mishkal_azmi": 0,
        "degem_nm": "אף1",
        "nefach_manoa": 0,
        "degem_manoa": "H",
        "hanaa_cd": "1",
        "hanaa_nm": "4X2"
      }
    ]
  }
}
```

<a id="resource-cme"></a>

### `cme` · כלי צמ"ה (ציוד מכני הנדסי)

**הגדרת המפרסם בתמצית** · כלי ציוד מכני הנדסי פעילים לפי מספר כלי. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/construction_equipment)

**יצירת משאב לפי הקטלוג** · 2020-01-29.

**פרופיל חי** · 476 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                   | משמעות                       | DataStore / JSON         | null / רווח | ערכים נצפים                                                                                                                                                  |
| --------------------- | ---------------------------- | ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_id`                 | מזהה שורת DataStore          | int / number             | 0 / 0       | הושמט                                                                                                                                                        |
| `mispar_tzama`        | מספר כלי צמ״ה                | numeric / number         | 0 / 0       | הושמט                                                                                                                                                        |
| `mispar_shilda`       | מספר שלדה                    | text / string            | 0 / 0       | הושמט                                                                                                                                                        |
| `shilda_totzar_cd`    | קוד תוצר שלדה                | numeric / number         | 0 / 0       | 80 · `200`, `525`, `103`, `395`, `824`, `105`, `745`, `1096`                                                                                                 |
| `shilda_totzar_en_nm` | שם תוצר שלדה באנגלית         | text / string            | 0 / 0       | 80 · `"CATERPILLAR"`, `"LINDE"`, `"BOMAG"`, `"HYUNDAI"`, `"TOYOTA"`, `"J.C.B (BAMFORD)"`, `"STILL"`, `"HANGCHA"`                                             |
| `shnat_yitzur`        | שנת ייצור                    | numeric / number         | 0 / 0       | 45 · `2008`, `2020`, `2026`, `2019`, `2018`, `2025`, `2000`, `2017`                                                                                          |
| `sug_tzama_cd`        | קוד סוג צמ״ה                 | numeric / number         | 0 / 0       | 30 · `509`, `512`, `121`, `138`, `539`, `120`, `519`, `312`                                                                                                  |
| `sug_tzama_nm`        | תיאור סוג צמ״ה               | text / string            | 0 / 0       | 30 · `"מלגזה מנוע שריפה"`, `"מלגזה מנוע חשמל"`, `"יעה אופני"`, `"מחפר זחלי זעיר"`, `"במת הרמה"`, `"יעה זחלי"`, `"מעמיס טלסקופי/מלגזה"`, `"מכבש גלילי ממונע"` |
| `hanaa_cd`            | קוד · הנעה                   | numeric / null, number   | 1 / 0       | 4 · `3`, `4`, `5`, `6`                                                                                                                                       |
| `hanaa_nm`            | הנעה                         | text / string            | 0 / 1       | 4 · `"סולר"`, `"סוללות"`, `"רשת חשמל"`, `"אחר"`                                                                                                              |
| `rishum_date`         | תאריך רישום כלי              | text / string            | 0 / 0       | 330 · `"2008-06-04"`, `"2008-06-02"`, `"2001-04-19"`, `"2012-01-10"`, `"2022-02-24"`, `"2018-08-20"`, `"2008-06-03"`, `"2000-10-30"`                         |
| `koah_sus`            | כוח סוס לפי שם השדה          | numeric / number         | 0 / 0       | 102 · `0`, `52`, `60`, `48`, `75`, `47`, `35`, `80`                                                                                                          |
| `mishkal_ton`         | משקל עצמי בטונות לפי שם השדה | numeric / number, number | 0 / 0       | 179 · `0`, `3`, `3.9`, `3.2`, `4.2`, `4.3`, `12.6`, `1.56`                                                                                                   |
| `tokef_date`          | תאריך תוקף                   | text / string            | 0 / 0       | 291 · `"2027-05-01"`, `"1986-05-01"`, `"2027-08-19"`, `"2018-05-01"`, `"2019-05-01"`, `"2026-05-01"`, `"2026-12-31"`, `"2027-02-23"`                         |
| `mishkal_kolel_ton`   | משקל כולל בטונות             | numeric / number, number | 0 / 0       | 92 · `0`, `6.7`, `6.1`, `6.26`, `5.8`, `12.9`, `15`, `2.5`                                                                                                   |
| `kosher_harama_ton`   | כושר הרמה בטונות             | numeric / number, number | 0 / 0       | 38 · `0`, `2.5`, `3`, `2`, `3.5`, `1.8`, `1.6`, `1`                                                                                                          |
| `hagbala_cd_1`        | קוד הגבלה 1                  | text / string            | 0 / 11      | 5 · `"1"`, `"2"`, `"3"`, `"5"`, `"E"`                                                                                                                        |
| `hagbala_nm_1`        | תיאור הגבלה 1                | text / string            | 0 / 11      | 5 · `"עד 30 קמש"`, `"מעל 30 קמש"`, `"מעל 3.45 מטר"`, `"איסור גרירה"`, `"לא ידוע קוד E"`                                                                      |
| `hagbala_cd_2`        | קוד הגבלה 2                  | text / string            | 0 / 455     | 4 · `"8"`, `"D"`, `"7"`, `"3"`                                                                                                                               |
| `hagbala_nm_2`        | תיאור הגבלה 2                | text / string            | 0 / 455     | 4 · `"רוחב מעל 2.55 מטר"`, `"לא ידוע קוד D"`, `"רישיון נהיגה 1"`, `"מעל 3.45 מטר"`                                                                           |
| `hagbala_cd_3`        | קוד הגבלה 3                  | text / string            | 0 / 475     | 1 · `"8"`                                                                                                                                                    |
| `hagbala_nm_3`        | תיאור הגבלה 3                | text / string            | 0 / 475     | 1 · `"רוחב מעל 2.55 מטר"`                                                                                                                                    |
| `hagbala_cd_4`        | קוד הגבלה 4                  | text / string            | 0 / 476     | —                                                                                                                                                            |
| `hagbala_nm_4`        | תיאור הגבלה 4                | text / string            | 0 / 476     | —                                                                                                                                                            |
| `degem_nm`            | שם דגם                       | text / string            | 0 / 0       | 313 · `"955"`, `"BW120AD4"`, `"ES1932"`, `"BW65D"`, `"M226CP"`, `"ES1530L"`, `"BW120AD5"`, `"02-8FDF25"`                                                     |

**JSON בפועל · 23/11/2026 13:00:55** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "shilda_totzar_cd": 689,
        "shilda_totzar_en_nm": "MAXILIFT-H.C",
        "shnat_yitzur": 2022,
        "sug_tzama_cd": 509,
        "sug_tzama_nm": "מלגזה מנוע שריפה",
        "hanaa_cd": 3,
        "hanaa_nm": "סולר",
        "rishum_date": "2022-07-07",
        "koah_sus": 47,
        "mishkal_ton": 4.25,
        "tokef_date": "2022-07-06",
        "mishkal_kolel_ton": 7.25,
        "kosher_harama_ton": 3,
        "hagbala_cd_1": "1"
      },
      {
        "shilda_totzar_cd": 689,
        "shilda_totzar_en_nm": "MAXILIFT-H.C",
        "shnat_yitzur": 2008,
        "sug_tzama_cd": 512,
        "sug_tzama_nm": "מלגזה מנוע חשמל",
        "hanaa_cd": 4,
        "hanaa_nm": "סוללות",
        "rishum_date": "2008-06-02",
        "koah_sus": 0,
        "mishkal_ton": 3,
        "tokef_date": "2027-06-01",
        "mishkal_kolel_ton": 0,
        "kosher_harama_ton": 1.8,
        "hagbala_cd_1": "1"
      }
    ]
  }
}
```

<a id="resource-twowheeled"></a>

### `twoWheeled` · מספרי רישוי של כלי רכב דו גלגליים

**הגדרת המפרסם בתמצית** · פרטים טכניים של כלי רכב דו־גלגליים פעילים. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/motorcycle)

**יצירת משאב לפי הקטלוג** · 2019-12-09.

**פרופיל חי** · 626 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                         | משמעות                           | DataStore / JSON       | null / רווח | ערכים נצפים                                                                                                                                        |
| --------------------------- | -------------------------------- | ---------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                       | מזהה שורת DataStore              | int / number           | 0 / 0       | הושמט                                                                                                                                              |
| `mispar_rechev`             | מספר רישוי                       | numeric / number       | 0 / 0       | הושמט                                                                                                                                              |
| `tozeret_cd`                | קוד תוצר                         | numeric / number       | 0 / 0       | 47 · `617`, `476`, `683`, `952`, `1602`, `40`, `736`, `560`                                                                                        |
| `tozeret_nm`                | שם תוצר                          | text / string          | 0 / 0       | 47 · `"ימאהה צרפת"`, `"ימאהה יפן"`, `"סוזוקי יפן"`, `"דיילים ד. קורי"`, `"אס ווי אמ סין"`, `"סאן יאנג סין"`, `"פיאג'ו איטליה"`, `"קוואסאקי תאילנ"` |
| `tozeret_eretz_nm`          | ארץ תוצר                         | text / string          | 0 / 0       | 15 · `"יפן"`, `"צרפת"`, `"סין"`, `"ד. קוריאה"`, `"איטליה"`, `"תאילנד"`, `"טאיוואן"`, `"אוסטריה"`                                                   |
| `degem_nm`                  | שם דגם                           | text / string          | 0 / 0       | 242 · `"SH28"`, `"SH14"`, `"SH13"`, `"TY4000D-18E"`, `"SH12"`, `"SJ09  T-MAX"`, `"FDA12"`, `"XC12"`                                                |
| `shnat_yitzur`              | שנת ייצור                        | numeric / number       | 0 / 0       | 43 · `2026`, `2025`, `2021`, `2018`, `2023`, `2024`, `2022`, `2016`                                                                                |
| `sug_delek_cd`              | קוד סוג דלק                      | numeric / number       | 0 / 0       | 2 · `1`, `4`                                                                                                                                       |
| `sug_delek_nm`              | סוג דלק                          | text / string          | 0 / 0       | 2 · `"בנזין"`, `"חשמל"`                                                                                                                            |
| `mishkal_kolel`             | משקל כולל לפי המקור              | numeric / number       | 0 / 0       | 66 · `0`, `221`, `415`, `365`, `319`, `269`, `390`, `220`                                                                                          |
| `mida_zmig_kidmi`           | מידת צמיג קדמי                   | text / string          | 0 / 0       | 89 · `"120/70-15"`, `"120/70-14"`, `"120/70-17"`, `"110/70-12"`, `"120/70ZR17"`, `"90/90-21"`, `"80/100-21"`, `"100/90-14"`                        |
| `mida_zmig_ahori`           | מידת צמיג אחורי                  | text / string          | 0 / 3       | 114 · `"140/70-14"`, `"160/60-15"`, `"150/70-13"`, `"140/60-14"`, `"140/60-13"`, `"180/55ZR17"`, `"130/70-12"`, `"120/70-12"`                      |
| `kod_omes_zmig_kidmi`       | קוד עומס צמיג קדמי               | numeric / number       | 0 / 0       | 29 · `56`, `0`, `58`, `51`, `55`, `54`, `44`, `47`                                                                                                 |
| `kod_omes_zmig_ahori`       | קוד עומס צמיג אחורי              | numeric / number       | 0 / 0       | 31 · `68`, `0`, `64`, `67`, `73`, `63`, `62`, `58`                                                                                                 |
| `kod_mehirut_zmig_kidmi`    | קוד מהירות צמיג קדמי             | text / string          | 0 / 97      | 14 · `"S"`, `"P"`, `"H"`, `"W"`, `"L"`, `"N"`, `"J"`, `"V"`                                                                                        |
| `kod_mehirut_zmig_ahori`    | קוד מהירות צמיג אחורי            | text / string          | 0 / 97      | 14 · `"S"`, `"P"`, `"H"`, `"W"`, `"L"`, `"N"`, `"J"`, `"V"`                                                                                        |
| `nefach_manoa`              | נפח מנוע                         | numeric / number       | 0 / 0       | 85 · `292`, `125`, `124`, `0`, `395`, `249`, `530`, `689`                                                                                          |
| `hespek`                    | הספק, יש לאמת יחידה              | numeric / null, number | 87 / 0      | 137 · `27.93`, `27.9`, `47.46`, `33.0`, `5.42`, `10.0`, `45.8`, `12.2`                                                                             |
| `misgeret`                  | מספר שלדה                        | text / string          | 0 / 0       | הושמט                                                                                                                                              |
| `moed_aliya_lakvish`        | מועד עלייה לכביש בגרעיניות המקור | text / string          | 0 / 91      | 149 · `"2026-5"`, `"2025-1"`, `"2026-2"`, `"2026-10"`, `"2026-1"`, `"2021-2"`, `"2021-1"`, `"2018-2"`                                              |
| `sug_rechev_EU_cd`          | קוד קטגוריה אירופית              | text / string          | 0 / 0       | 4 · `"L2"`, `"L1"`, `"L3"`, `"L7"`                                                                                                                 |
| `sug_rechev_cd`             | קוד · סוג רכב                    | numeric / number       | 0 / 0       | 4 · `10`, `60`, `20`, `85`                                                                                                                         |
| `sug_rechev_nm`             | סוג רכב                          | text / string          | 0 / 0       | 4 · `"אופנוע"`, `"תלת אופנוע"`, `"קטנוע"`, `"רכב זעיר"`                                                                                            |
| `mispar_manoa`              | מספר מנוע                        | text / string          | 0 / 2       | הושמט                                                                                                                                              |
| `horaat_rishum`             | קוד הוראת רישום                  | numeric / null, number | 86 / 0      | 227 · `258199`, `212040`, `182032`, `258212`, `227012`, `162131`, `192109`, `268021`                                                               |
| `baalut`                    | בעלות נוכחית                     | text / string          | 0 / 0       | 3 · `"פרטי"`, `"חברה"`, `"סוחר"`                                                                                                                   |
| `mkoriut_nm`                | תיאור מקוריות                    | text / string          | 0 / 618     | 4 · `"ביס לנהיגה\""`, `"מדינת ישראל"`, `"יבוא אישי-משומש"`, `"יבוא אישי"`                                                                          |
| `mispar_mekomot_leyd_nahag` | מספר מקומות ליד הנהג             | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                                                                       |
| `mispar_mekomot`            | מספר מקומות לפי הגדרת המקור      | numeric / null, number | 75 / 0      | 2 · `1`, `2`                                                                                                                                       |

**JSON בפועל · 23/11/2026 13:01:05** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tozeret_cd": 143,
        "tozeret_nm": "ב מ וו גרמניה",
        "tozeret_eretz_nm": "גרמניה",
        "degem_nm": "R1200GS 0307A",
        "shnat_yitzur": 2005,
        "sug_delek_cd": 1,
        "sug_delek_nm": "בנזין",
        "mishkal_kolel": 0,
        "mida_zmig_kidmi": "110/80R19",
        "mida_zmig_ahori": "150/70R17",
        "kod_omes_zmig_kidmi": 0,
        "kod_omes_zmig_ahori": 0,
        "kod_mehirut_zmig_kidmi": "",
        "kod_mehirut_zmig_ahori": ""
      },
      {
        "tozeret_cd": 333,
        "tozeret_nm": "הארלי דיוידסון",
        "tozeret_eretz_nm": "ארהב\"",
        "degem_nm": "1BKL1",
        "shnat_yitzur": 1997,
        "sug_delek_cd": 1,
        "sug_delek_nm": "בנזין",
        "mishkal_kolel": 0,
        "mida_zmig_kidmi": "MH90XB16",
        "mida_zmig_ahori": "",
        "kod_omes_zmig_kidmi": 0,
        "kod_omes_zmig_ahori": 0,
        "kod_mehirut_zmig_kidmi": "",
        "kod_mehirut_zmig_ahori": ""
      }
    ]
  }
}
```

<a id="resource-publictransport"></a>

### `publicTransport` · קובץ מספרי רישוי של כלי הרכב הציבוריים הפעילים

**הגדרת המפרסם בתמצית** · כלי רכב ציבוריים פעילים: מוניות, מוניות שירות ואוטובוסים להסעה בתשלום. תדירות עדכון יומית מתועדת. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/kli_rechev_ciburiim)

**יצירת משאב לפי הקטלוג** · 2023-06-14.

**פרופיל חי** · 676 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                         | משמעות                                | DataStore / JSON       | null / רווח | ערכים נצפים                                                                                                                                                                                         |
| --------------------------- | ------------------------------------- | ---------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                       | מזהה שורת DataStore                   | int / number           | 0 / 0       | הושמט                                                                                                                                                                                               |
| `mispar_rechev`             | מספר רישוי                            | numeric / number       | 0 / 0       | הושמט                                                                                                                                                                                               |
| `sug_rechev_cd`             | קוד · סוג רכב                         | numeric / number       | 0 / 0       | 8 · `121`, `622`, `611`, `614`, `615`, `620`, `630`, `612`                                                                                                                                          |
| `sug_rechev_nm`             | סוג רכב                               | text / string          | 0 / 0       | 8 · `"מונית"`, `"אוטובוס זעיר צבורי"`, `"אוטובוס צבורי עירוני"`, `"אוטובוס צבורי להסע מיוחד"`, `"אוטובוס צבורי עיר מפרק"`, `"אוטובוס צבורי לסיור"`, `"אוטובוס  פרטי"`, `"אוטובוס צבורי בין-עירוני"` |
| `shnat_yitzur`              | שנת ייצור                             | numeric / number       | 0 / 0       | 21 · `2023`, `2022`, `2021`, `2019`, `2025`, `2024`, `2018`, `2010`                                                                                                                                 |
| `mishkal_kolel`             | משקל כולל לפי המקור                   | numeric / number       | 0 / 0       | 79 · `19000`, `19500`, `1835`, `3000`, `3100`, `2135`, `28000`, `2800`                                                                                                                              |
| `tozeret_cd`                | קוד תוצר                              | numeric / number       | 0 / 0       | 39 · `724`, `1014`, `413`, `806`, `593`, `361`, `839`, `801`                                                                                                                                        |
| `tozeret_nm`                | שם תוצר                               | text / string          | 0 / 0       | 39 · `"פולקסווגן גרמנ"`, `"בי ווי די סין"`, `"טויוטה יפן"`, `"מרצדס בנץ ספרד"`, `"מרצדס בנץ גרמנ"`, `"וולבו שבדיה"`, `"טויוטה טורקיה"`, `"אוטוקאר טורקיה"`                                          |
| `tzeva_cd`                  | קוד · צבע                             | numeric / number       | 0 / 0       | 31 · `80`, `46`, `25`, `20`, `11`, `83`, `68`, `60`                                                                                                                                                 |
| `tzeva_rechev`              | צבע                                   | text / string          | 0 / 0       | 31 · `"שנהב לבן"`, `"ירוק מטל"`, `"כסף"`, `"אפור"`, `"שחור מטלי"`, `"רב גווני"`, `"קרם"`, `"צהוב"`                                                                                                  |
| `degem_cd`                  | קוד דגם                               | numeric / null, number | 286 / 0     | 234 · `225`, `190`, `79`, `43`, `3940`, `119`, `257`, `147`                                                                                                                                         |
| `degem_nm`                  | שם דגם                                | text / string          | 0 / 0       | 210 · `"B12E01"`, `"B12B"`, `"447.705"`, `"KENT BRT"`, `"ZWE211L-DWXNBW"`, `"BC12E01"`, `"KLQ6129GQ2"`, `"K9UD"`                                                                                    |
| `kinuy_mishari`             | כינוי מסחרי                           | text / string          | 0 / 291     | 86 · `"VITO"`, `"OCTAVIA"`, `"CARAVELLE"`, `"RAV 4 HYBRID"`, `"COROLLA HSD SDN"`, `"COROLLA TS HSD"`, `"T6 TRANSPORTER"`, `"TRANSPORTER"`                                                           |
| `sug_rechev_EU_cd`          | קוד קטגוריה אירופית                   | text / string          | 0 / 0       | 3 · `"M1"`, `"M3"`, `"M2"`                                                                                                                                                                          |
| `sug_rechev_EU_nm`          | תיאור קטגוריה אירופית                 | text / string          | 0 / 676     | —                                                                                                                                                                                                   |
| `bitul_cd`                  | קוד סטטוס ביטול/הפקדה                 | text / string          | 0 / 0       | 4 · `"0"`, `"C"`, `"2"`, `"8"`                                                                                                                                                                      |
| `bitul_nm`                  | תיאור סטטוס ביטול/הפקדה               | text / string          | 0 / 0       | 4 · `"לא מבוטל"`, `"הפקדה"`, `"בטול רשום לפני מכירה"`, `"אובדן גמור"`                                                                                                                               |
| `bitul_dt`                  | תאריך ביטול או אירוע סטטוס, לפי המאגר | text / string          | 0 / 651     | 10 · `"2026-09-14"`, `"2026-09-15"`, `"2026-05-20"`, `"2026-05-19"`, `"2026-05-11"`, `"2026-08-25"`, `"2026-07-12"`, `"2026-06-25"`, `"2026-05-27"`, `"2026-06-28"`                                 |
| `tokef_dt`                  | תוקף רישיון                           | text / string          | 0 / 0       | 268 · `"2027-08-31"`, `"2027-09-30"`, `"2027-03-31"`, `"2027-07-31"`, `"2027-09-12"`, `"2027-04-30"`, `"2027-05-21"`, `"2027-06-30"`                                                                |
| `mispar_mekomot`            | מספר מקומות לפי הגדרת המקור           | numeric / null, number | 2 / 0       | 24 · `3`, `6`, `55`, `35`, `8`, `53`, `47`, `34`                                                                                                                                                    |
| `mispar_mekomot_leyd_nahag` | מספר מקומות ליד הנהג                  | numeric / number       | 0 / 0       | 3 · `0`, `1`, `2`                                                                                                                                                                                   |

**JSON בפועל · 23/11/2026 13:01:15** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "sug_rechev_cd": 611,
        "sug_rechev_nm": "אוטובוס צבורי עירוני",
        "shnat_yitzur": 2017,
        "mishkal_kolel": 18300,
        "tozeret_cd": 531,
        "tozeret_nm": "מאן גרמניה",
        "tzeva_cd": 46,
        "tzeva_rechev": "ירוק מטל",
        "degem_cd": null,
        "degem_nm": "NL323F",
        "kinuy_mishari": "",
        "sug_rechev_EU_cd": "M3",
        "sug_rechev_EU_nm": "",
        "bitul_cd": "0"
      },
      {
        "sug_rechev_cd": 611,
        "sug_rechev_nm": "אוטובוס צבורי עירוני",
        "shnat_yitzur": 2017,
        "mishkal_kolel": 18300,
        "tozeret_cd": 531,
        "tozeret_nm": "מאן גרמניה",
        "tzeva_cd": 46,
        "tzeva_rechev": "ירוק מטל",
        "degem_cd": null,
        "degem_nm": "NL323F",
        "kinuy_mishari": "",
        "sug_rechev_EU_cd": "M3",
        "sug_rechev_EU_nm": "",
        "bitul_cd": "0"
      }
    ]
  }
}
```

<a id="resource-history_1"></a>

### `history_1` · היסטוריית כלי רכב פרטיים (1)

**הגדרת המפרסם בתמצית** · פרטיים פעילים מ־2017 ואילך. קובץ 1 לנסועה ושינוי מבנה, קובץ 2 לאירועי בעלות. תיאור הקטלוג מחריג בקובץ 1 רכבים שהיה להם מספר קודם. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/shinui_mivne)

**יצירת משאב לפי הקטלוג** · 2021-12-21.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                     | משמעות                | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                         |
| ----------------------- | --------------------- | ---------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                   | מזהה שורת DataStore   | int / number     | 0 / 0       | הושמט                                                                                                                               |
| `mispar_rechev`         | מספר רישוי            | numeric / number | 0 / 0       | הושמט                                                                                                                               |
| `mispar_manoa`          | מספר מנוע             | text / string    | 0 / 0       | הושמט                                                                                                                               |
| `kilometer_test_aharon` | נסועה בטסט האחרון     | numeric / number | 0 / 0       | 24 · `0`, `39648`, `180154`, `137246`, `132400`, `130460`, `76100`, `240619`                                                        |
| `shinui_mivne_ind`      | אינדיקטור לשינוי מבנה | numeric / number | 0 / 0       | 1 · `1`                                                                                                                             |
| `gapam_ind`             | אינדיקטור הוספת גפ״מ  | numeric / number | 0 / 0       | 1 · `0`                                                                                                                             |
| `shnui_zeva_ind`        | אינדיקטור שינוי צבע   | numeric / number | 0 / 0       | 2 · `0`, `1`                                                                                                                        |
| `shinui_zmig_ind`       | אינדיקטור שינוי צמיג  | numeric / number | 0 / 0       | 2 · `1`, `0`                                                                                                                        |
| `rishum_rishon_dt`      | תאריך רישום ראשוני    | text / string    | 0 / 0       | 24 · `"2023-06-27"`, `"2017-07-23"`, `"2023-06-26"`, `"2017-01-02"`, `"2018-03-20"`, `"2017-09-10"`, `"2019-06-30"`, `"2017-10-01"` |
| `mkoriut_nm`            | תיאור מקוריות         | text / string    | 0 / 22      | 2 · `"החכר"`, `"יבוא אישי-משומש"`                                                                                                   |

**JSON בפועל · 23/11/2026 13:01:24** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "kilometer_test_aharon": 0,
        "shinui_mivne_ind": 1,
        "gapam_ind": 0,
        "shnui_zeva_ind": 0,
        "shinui_zmig_ind": 1,
        "rishum_rishon_dt": "2023-06-26",
        "mkoriut_nm": ""
      },
      {
        "kilometer_test_aharon": 39648,
        "shinui_mivne_ind": 1,
        "gapam_ind": 0,
        "shnui_zeva_ind": 1,
        "shinui_zmig_ind": 0,
        "rishum_rishon_dt": "2023-06-27",
        "mkoriut_nm": ""
      }
    ]
  }
}
```

<a id="resource-history_2"></a>

### `history_2` · היסטוריית כלי רכב פרטיים (2)

**הגדרת המפרסם בתמצית** · פרטיים פעילים מ־2017 ואילך. קובץ 1 לנסועה ושינוי מבנה, קובץ 2 לאירועי בעלות. תיאור הקטלוג מחריג בקובץ 1 רכבים שהיה להם מספר קודם. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/shinui_mivne)

**יצירת משאב לפי הקטלוג** · 2022-04-28.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה             | משמעות               | DataStore / JSON | null / רווח | ערכים נצפים                                                                         |
| --------------- | -------------------- | ---------------- | ----------- | ----------------------------------------------------------------------------------- |
| `_id`           | מזהה שורת DataStore  | int / number     | 0 / 0       | הושמט                                                                               |
| `mispar_rechev` | מספר רישוי           | numeric / number | 0 / 0       | הושמט                                                                               |
| `baalut_dt`     | מועד בעלות לפי רבעון | numeric / number | 0 / 0       | 17 · `202209`, `202403`, `202205`, `202501`, `201705`, `202009`, `202310`, `202202` |
| `baalut`        | בעלות נוכחית         | text / string    | 0 / 0       | 2 · `"פרטי"`, `"סוחר"`                                                              |

**JSON בפועל · 23/11/2026 13:01:26** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "baalut_dt": 202202,
        "baalut": "פרטי"
      },
      {
        "baalut_dt": 202205,
        "baalut": "פרטי"
      }
    ]
  }
}
```

<a id="resource-modeldetails"></a>

### `modelDetails` · תוצרים ודגמים של כלי רכב WLTP

**הגדרת המפרסם בתמצית** · דגמים פרטיים מ־1996 ומסחריים מ־1998, כולל WLTP. המשאב השני מכיל ספירות לפי דגם. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/degem-rechev-wltp)

**יצירת משאב לפי הקטלוג** · 2019-06-25.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                                            | משמעות                                                      | DataStore / JSON       | null / רווח | ערכים נצפים                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- | ---------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `_id`                                          | מזהה שורת DataStore                                         | int / number           | 0 / 0       | הושמט                                                                                           |
| `sug_degem`                                    | סוג דגם                                                     | text / string          | 0 / 0       | 1 · `"M"`                                                                                       |
| `tozeret_cd`                                   | קוד תוצר                                                    | numeric / number       | 0 / 0       | 3 · `19`, `5`, `8`                                                                              |
| `tozeret_nm`                                   | שם תוצר                                                     | text / string          | 0 / 0       | 3 · `"אאודי גרמניה"`, `"צ'אנג יאנג סין"`, `"אל.טי.איי."`                                        |
| `tozeret_eretz_nm`                             | ארץ תוצר                                                    | text / string          | 0 / 0       | 3 · `"גרמניה"`, `"סין"`, `"בריטניה"`                                                            |
| `tozar`                                        | שם תוצר ללא מדינה                                           | text / string          | 0 / 0       | 3 · `"אאודי"`, `"צ'אנג יאנג"`, `"אל.טי.איי."`                                                   |
| `degem_cd`                                     | קוד דגם                                                     | numeric / number       | 0 / 0       | 14 · `179`, `11`, `1`, `14`, `18`, `19`, `21`, `10`                                             |
| `degem_nm`                                     | שם דגם                                                      | text / string          | 0 / 0       | 8 · `"4LB0EL"`, `"4LBOML"`, `"4MN0N2"`, `"8RB01A"`, `"4LBODL"`, `"TXI"`, `"ALBODL"`, `"4LB0ML"` |
| `shnat_yitzur`                                 | שנת ייצור                                                   | numeric / number       | 0 / 0       | 11 · `2007`, `2008`, `2021`, `2022`, `2023`, `2024`, `2001`, `2002`, `2015`, `2016`, `2017`     |
| `kvuzat_agra_cd`                               | קוד קבוצת אגרה                                              | numeric / number       | 0 / 0       | 3 · `7`, `6`, `3`                                                                               |
| `nefah_manoa`                                  | נפח מנוע במפרט הדגם                                         | numeric / number       | 0 / 0       | 5 · `2967`, `4163`, `3597`, `1984`, `2664`                                                      |
| `mishkal_kolel`                                | משקל כולל לפי המקור                                         | numeric / number       | 0 / 0       | 6 · `3065`, `3120`, `2900`, `3030`, `2380`, `2400`                                              |
| `gova`                                         | גובה, יחידה טעונה אימות                                     | numeric / number       | 0 / 0       | 3 · `173`, `0`, `183`                                                                           |
| `hanaa_cd`                                     | קוד · הנעה                                                  | numeric / null, number | 4 / 0       | 2 · `3`, `1`                                                                                    |
| `hanaa_nm`                                     | הנעה                                                        | text / string          | 0 / 0       | 3 · `"4X4"`, `"לא ידוע קוד"`, `"4X2"`                                                           |
| `mazgan_ind`                                   | מזגן                                                        | numeric / number       | 0 / 0       | 1 · `1`                                                                                         |
| `abs_ind`                                      | ABS                                                         | numeric / number       | 0 / 0       | 2 · `1`, `0`                                                                                    |
| `kariot_avir_source`                           | מקור התקנת כריות אוויר                                      | text / string          | 0 / 2       | 1 · `"6"`                                                                                       |
| `mispar_kariot_avir`                           | כריות אוויר                                                 | numeric / number       | 0 / 0       | 2 · `6`, `0`                                                                                    |
| `hege_koah_ind`                                | הגה כוח                                                     | numeric / number       | 0 / 0       | 2 · `1`, `0`                                                                                    |
| `automatic_ind`                                | גיר אוטומטי                                                 | numeric / number       | 0 / 0       | 1 · `1`                                                                                         |
| `halonot_hashmal_source`                       | מקור התקנת חלונות חשמל                                      | text / string          | 0 / 2       | 1 · `"4"`                                                                                       |
| `mispar_halonot_hashmal`                       | חלונות חשמל                                                 | numeric / number       | 0 / 0       | 2 · `4`, `0`                                                                                    |
| `halon_bagg_ind`                               | אינדיקטור לחלון בגג                                         | numeric / number       | 0 / 0       | 2 · `1`, `0`                                                                                    |
| `galgaley_sagsoget_kala_ind`                   | אינדיקטור לגלגלי סגסוגת קלה                                 | numeric / number       | 0 / 0       | 2 · `1`, `0`                                                                                    |
| `argaz_ind`                                    | אינדיקטור לארגז                                             | numeric / number       | 0 / 0       | 1 · `0`                                                                                         |
| `merkav`                                       | סוג מרכב                                                    | text / string          | 0 / 0       | 2 · `"פנאי-שטח"`, `"סגור/משלוח"`                                                                |
| `ramat_gimur`                                  | רמת גימור                                                   | text / string          | 0 / 17      | 3 · `"COMFORT"`, `"LUXURY"`, `"TX1"`                                                            |
| `delek_cd`                                     | קוד דלק ברשומת הדגם                                         | numeric / number       | 0 / 0       | 2 · `2`, `1`                                                                                    |
| `delek_nm`                                     | שם סוג הדלק ברשומת הדגם                                     | text / string          | 0 / 0       | 2 · `"דיזל"`, `"בנזין"`                                                                         |
| `mispar_dlatot`                                | מספר דלתות                                                  | numeric / number       | 0 / 0       | 2 · `5`, `4`                                                                                    |
| `koah_sus`                                     | כוח סוס לפי שם השדה                                         | numeric / number       | 0 / 0       | 6 · `233`, `350`, `286`, `280`, `230`, `65`                                                     |
| `mispar_moshavim`                              | מספר מושבים                                                 | numeric / number       | 0 / 0       | 3 · `7`, `5`, `6`                                                                               |
| `bakarat_yatzivut_ind`                         | בקרת יציבות                                                 | numeric / number       | 0 / 0       | 2 · `1`, `0`                                                                                    |
| `kosher_grira_im_blamim`                       | כושר גרירה עם בלמים                                         | numeric / number       | 0 / 0       | 4 · `750`, `0`, `3500`, `1920`                                                                  |
| `kosher_grira_bli_blamim`                      | כושר גרירה בלי בלמים                                        | numeric / number       | 0 / 0       | 2 · `750`, `0`                                                                                  |
| `sug_tkina_cd`                                 | קוד · סוג תקינה                                             | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `sug_tkina_nm`                                 | סוג תקינה                                                   | text / string          | 0 / 0       | 2 · `"לא ידוע קוד 0"`, `"אירופאית"`                                                             |
| `sug_mamir_cd`                                 | קוד · סוג ממיר                                              | numeric / number       | 0 / 0       | 2 · `0`, `2`                                                                                    |
| `sug_mamir_nm`                                 | סוג ממיר                                                    | text / string          | 0 / 0       | 2 · `"לא ידוע קוד 0"`, `"לוכד חלקיקים"`                                                         |
| `technologiat_hanaa_cd`                        | קוד · טכנולוגיית הנעה                                       | numeric / null         | 26 / 0      | —                                                                                               |
| `technologiat_hanaa_nm`                        | טכנולוגיית הנעה                                             | text / string          | 0 / 0       | 1 · `"הנעה רגילה"`                                                                              |
| `kamut_CO2`                                    | פליטת CO2 (NEDC)                                            | numeric / null, number | 23 / 0      | 1 · `172`                                                                                       |
| `kamut_NOX`                                    | פליטת NOX                                                   | numeric / null, number | 23 / 0      | 1 · `0.027`                                                                                     |
| `kamut_PM10`                                   | פליטת PM10                                                  | numeric / null, number | 23 / 0      | 1 · `0.001`                                                                                     |
| `kamut_HC`                                     | ערך פליטה במבחן לפי הסימון HC; יחידה טעונה אימות            | numeric / null, number | 23 / 0      | 1 · `0.039`                                                                                     |
| `kamut_HC_NOX`                                 | ערך פליטה במבחן לפי הסימון HC_NOX; יחידה טעונה אימות        | numeric / null         | 26 / 0      | —                                                                                               |
| `kamut_CO`                                     | ערך פליטה במבחן לפי הסימון CO; יחידה טעונה אימות            | numeric / null, number | 23 / 0      | 1 · `0.335`                                                                                     |
| `kamut_CO2_city`                               | פליטת CO2 (עירוני)                                          | numeric / null         | 26 / 0      | —                                                                                               |
| `kamut_NOX_city`                               | ערך פליטה במבחן לפי הסימון NOX_city; יחידה טעונה אימות      | numeric / null         | 26 / 0      | —                                                                                               |
| `kamut_PM10_city`                              | ערך פליטה במבחן לפי הסימון PM10_city; יחידה טעונה אימות     | numeric / null         | 26 / 0      | —                                                                                               |
| `kamut_HC_city`                                | ערך פליטה במבחן לפי הסימון HC_city; יחידה טעונה אימות       | numeric / null         | 26 / 0      | —                                                                                               |
| `kamut_CO_city`                                | ערך פליטה במבחן לפי הסימון CO_city; יחידה טעונה אימות       | numeric / null         | 26 / 0      | —                                                                                               |
| `kamut_CO2_hway`                               | פליטת CO2 (בינעירוני)                                       | numeric / null         | 26 / 0      | —                                                                                               |
| `kamut_NOX_hway`                               | ערך פליטה במבחן לפי הסימון NOX_hway; יחידה טעונה אימות      | numeric / null         | 26 / 0      | —                                                                                               |
| `kamut_PM10_hway`                              | ערך פליטה במבחן לפי הסימון PM10_hway; יחידה טעונה אימות     | numeric / null         | 26 / 0      | —                                                                                               |
| `kamut_HC_hway`                                | ערך פליטה במבחן לפי הסימון HC_hway; יחידה טעונה אימות       | numeric / null         | 26 / 0      | —                                                                                               |
| `kamut_CO_hway`                                | ערך פליטה במבחן לפי הסימון CO_hway; יחידה טעונה אימות       | numeric / null         | 26 / 0      | —                                                                                               |
| `madad_yarok`                                  | מדד ירוק                                                    | numeric / null, number | 19 / 0      | 2 · `327.0`, `338.0`                                                                            |
| `kvutzat_zihum`                                | קבוצת זיהום                                                 | numeric / null, number | 19 / 0      | 1 · `15`                                                                                        |
| `bakarat_stiya_menativ_ind`                    | התראת סטיה מנתיב                                            | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `bakarat_stiya_menativ_makor_hatkana`          | מקור התקנה · בקרת סטייה מנתיב                               | text / string          | 0 / 22      | 1 · `"יצרן"`                                                                                    |
| `nitur_merhak_milfanim_ind`                    | ניטור מרחק מלפנים                                           | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `nitur_merhak_milfanim_makor_hatkana`          | מקור התקנה · ניטור מרחק מלפנים                              | text / string          | 0 / 22      | 1 · `"יצרן"`                                                                                    |
| `zihuy_beshetah_nistar_ind`                    | אינדיקטור · זיהוי בשטח נסתר                                 | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `bakarat_shyut_adaptivit_ind`                  | בקרת שיוט אדפטיבית                                          | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `zihuy_holchey_regel_ind`                      | אינדיקטור · זיהוי הולכי רגל                                 | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `zihuy_holchey_regel_makor_hatkana`            | מקור התקנה · זיהוי הולכי רגל                                | text / string          | 0 / 22      | 1 · `"יצרן"`                                                                                    |
| `maarechet_ezer_labalam_ind`                   | מערכת עזר לבלימה                                            | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `matzlemat_reverse_ind`                        | מצלמת רוורס                                                 | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `hayshaney_lahatz_avir_batzmigim_ind`          | חיישני לחץ אוויר                                            | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `hayshaney_hagorot_ind`                        | חיישני חגורות                                               | numeric / number       | 0 / 0       | 1 · `0`                                                                                         |
| `nikud_betihut`                                | ניקוד בטיחות                                                | numeric / null, number | 22 / 0      | 1 · `4.5`                                                                                       |
| `ramat_eivzur_betihuty`                        | רמת בטיחות                                                  | numeric / null, number | 22 / 0      | 1 · `4`                                                                                         |
| `teura_automatit_benesiya_kadima_ind`          | אינדיקטור · תאורה אוטומטית בנסיעה קדימה                     | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `shlita_automatit_beorot_gvohim_ind`           | אינדיקטור · שליטה אוטומטית באורות גבוהים                    | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `shlita_automatit_beorot_gvohim_makor_hatkana` | מקור התקנה · שליטה אוטומטית באורות גבוהים                   | text / string          | 0 / 22      | 1 · `"יצרן"`                                                                                    |
| `zihuy_matzav_hitkarvut_mesukenet_ind`         | התראת התנגשות                                               | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `zihuy_tamrurey_tnua_ind`                      | אינדיקטור · זיהוי תמרורים                                   | numeric / number       | 0 / 0       | 1 · `0`                                                                                         |
| `zihuy_rechev_do_galgali`                      | זיהוי דו־גלגלי                                              | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `zihuy_tamrurey_tnua_makor_hatkana`            | מקור התקנה · זיהוי תמרורים                                  | text / string          | 0 / 26      | —                                                                                               |
| `CO2_WLTP`                                     | ערך פליטה במבחן לפי הסימון CO2_WLTP; יחידה טעונה אימות      | numeric / null, number | 22 / 0      | 1 · `221`                                                                                       |
| `HC_WLTP`                                      | ערך פליטה במבחן לפי הסימון HC_WLTP; יחידה טעונה אימות       | numeric / null, number | 22 / 0      | 1 · `31.4`                                                                                      |
| `PM_WLTP`                                      | ערך פליטה במבחן לפי הסימון PM_WLTP; יחידה טעונה אימות       | numeric / null, number | 22 / 0      | 1 · `0.37`                                                                                      |
| `NOX_WLTP`                                     | ערך פליטה במבחן לפי הסימון NOX_WLTP; יחידה טעונה אימות      | numeric / null, number | 22 / 0      | 1 · `17.2`                                                                                      |
| `CO_WLTP`                                      | ערך פליטה במבחן לפי הסימון CO_WLTP; יחידה טעונה אימות       | numeric / null, number | 22 / 0      | 1 · `92.9`                                                                                      |
| `CO2_WLTP_NEDC`                                | ערך פליטה במבחן לפי הסימון CO2_WLTP_NEDC; יחידה טעונה אימות | numeric / null         | 26 / 0      | —                                                                                               |
| `bakarat_stiya_activ_s`                        | בקרת סטייה אקטיבית, קידוד טעון אימות                        | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `blima_otomatit_nesia_leahor`                  | בלימה אוטומטית בנסיעה לאחור                                 | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `bakarat_mehirut_isa`                          | בקרת מהירות ISA                                             | numeric / number       | 0 / 0       | 1 · `0`                                                                                         |
| `blimat_hirum_lifnei_holhei_regel_ofanaim`     | בלימת חירום להולכי רגל ורוכבי אופניים                       | numeric / number       | 0 / 0       | 2 · `0`, `1`                                                                                    |
| `hitnagshut_cad_shetah_met`                    | התנגשות צד/שטח מת לפי שם השדה                               | numeric / number       | 0 / 0       | 1 · `0`                                                                                         |
| `alco_lock`                                    | מערכת נעילת אלכוהול                                         | numeric / number       | 0 / 0       | 1 · `0`                                                                                         |
| `dg_metach_solela`                             | מתח סוללה לפי שם השדה, יחידה וקידוד טעונים אימות            | numeric / null         | 26 / 0      | —                                                                                               |
| `kinuy_mishari`                                | כינוי מסחרי                                                 | text / string          | 0 / 0       | 4 · `"Q7"`, `"Q8"`, `"Q5"`, `"מונית זוטובוס"`                                                   |

**JSON בפועל · 23/11/2026 13:01:27** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "sug_degem": "M",
        "tozeret_cd": 5,
        "tozeret_nm": "צ'אנג יאנג סין",
        "tozeret_eretz_nm": "סין",
        "tozar": "צ'אנג יאנג",
        "degem_cd": 179,
        "degem_nm": "4MN0N2",
        "shnat_yitzur": 2021,
        "kvuzat_agra_cd": 7,
        "nefah_manoa": 2967,
        "mishkal_kolel": 2900,
        "gova": 0,
        "hanaa_cd": null,
        "hanaa_nm": "לא ידוע קוד"
      },
      {
        "sug_degem": "M",
        "tozeret_cd": 8,
        "tozeret_nm": "אל.טי.איי.",
        "tozeret_eretz_nm": "בריטניה",
        "tozar": "אל.טי.איי.",
        "degem_cd": 11,
        "degem_nm": "TXI",
        "shnat_yitzur": 2001,
        "kvuzat_agra_cd": 6,
        "nefah_manoa": 2664,
        "mishkal_kolel": 2400,
        "gova": 183,
        "hanaa_cd": 1,
        "hanaa_nm": "4X2"
      }
    ]
  }
}
```

<a id="resource-modelcounts"></a>

### `modelCounts` · מאגר כמויות כלי רכב לפי תוצר, דגם ושנת יצור

**הגדרת המפרסם בתמצית** · דגמים פרטיים מ־1996 ומסחריים מ־1998, כולל WLTP. המשאב השני מכיל ספירות לפי דגם. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/degem-rechev-wltp)

**יצירת משאב לפי הקטלוג** · 2019-10-23.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                         | משמעות                             | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                                 |
| --------------------------- | ---------------------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                       | מזהה שורת DataStore                | int / number     | 0 / 0       | הושמט                                                                                                                                       |
| `sug_degem`                 | סוג דגם                            | text / string    | 0 / 0       | 2 · `"P"`, `"M"`                                                                                                                            |
| `tozeret_cd`                | קוד תוצר                           | numeric / number | 0 / 0       | 21 · `413`, `634`, `724`, `152`, `968`, `416`, `928`, `817`                                                                                 |
| `tozeret_nm`                | שם תוצר                            | text / string    | 0 / 0       | 21 · `"טויוטה יפן"`, `"ניסאן ספרד"`, `"פולקסווגן גרמנ"`, `"מרצדס בנץ הונג"`, `"אופל צרפת"`, `"קיה סלובקיה"`, `"רנו צרפת"`, `"סיטרואן צרפת"` |
| `tozeret_eretz_nm`          | ארץ תוצר                           | text / string    | 0 / 0       | 8 · `"יפן"`, `"גרמניה"`, `"צרפת"`, `"ספרד"`, `"הונגריה"`, `"סלובקיה"`, `"מקסיקו"`, `"צ'כיה"`                                                |
| `tozar`                     | שם תוצר ללא מדינה                  | text / string    | 0 / 0       | 16 · `"טויוטה"`, `"ניסאן"`, `"מרצדס"`, `"פולקסווגן"`, `"פיג'ו"`, `"אאודי"`, `"אופל"`, `"קיה"`                                               |
| `degem_cd`                  | קוד דגם                            | numeric / number | 0 / 0       | 26 · `94`, `24`, `156`, `10`, `61`, `20`, `201`, `742`                                                                                      |
| `degem_nm`                  | שם דגם                             | text / string    | 0 / 0       | 26 · `"AVA42L-ANXMBW"`, `"ZCYHZ"`, `"HM513G"`, `"JVWR51"`, `"KBNR20"`, `"KCTEEF"`, `"N1NFUN"`, `"BK14Z"`                                    |
| `shnat_yitzur`              | שנת ייצור                          | numeric / number | 0 / 0       | 16 · `2007`, `2017`, `2018`, `2008`, `2006`, `2020`, `1999`, `2003`                                                                         |
| `mispar_rechavim_pailim`    | כמות כלי רכב פעילים בקבוצת הדגם    | numeric / number | 0 / 0       | 20 · `0`, `2`, `4`, `489`, `67`, `1`, `8`, `717`                                                                                            |
| `mispar_rechavim_le_pailim` | כמות כלי רכב לא פעילים בקבוצת הדגם | numeric / number | 0 / 0       | 15 · `2`, `5`, `6`, `4`, `1`, `13`, `893`, `430`                                                                                            |
| `kinuy_mishari`             | כינוי מסחרי                        | text / string    | 0 / 0       | 26 · `"RAV 4 HYBRID"`, `"GRANDLAND X"`, `"CEED"`, `"PATHFINDER"`, `"TERRANO"`, `"KANGOO"`, `"XSARA 2"`, `"MAZDA3-SPORT"`                    |

**JSON בפועל · 23/11/2026 13:01:29** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "sug_degem": "P",
        "tozeret_cd": 413,
        "tozeret_nm": "טויוטה יפן",
        "tozeret_eretz_nm": "יפן",
        "tozar": "טויוטה",
        "degem_cd": 94,
        "degem_nm": "AVA42L-ANXMBW",
        "shnat_yitzur": 2018,
        "mispar_rechavim_pailim": 489,
        "mispar_rechavim_le_pailim": 13,
        "kinuy_mishari": "RAV 4 HYBRID"
      },
      {
        "sug_degem": "P",
        "tozeret_cd": 968,
        "tozeret_nm": "אופל צרפת",
        "tozeret_eretz_nm": "צרפת",
        "tozar": "אופל",
        "degem_cd": 24,
        "degem_nm": "ZCYHZ",
        "shnat_yitzur": 2020,
        "mispar_rechavim_pailim": 67,
        "mispar_rechavim_le_pailim": 6,
        "kinuy_mishari": "GRANDLAND X"
      }
    ]
  }
}
```

<a id="resource-recall"></a>

### `recall` · כלי רכב שלא ביצעו ריקול (קריאת שירות)

**הגדרת המפרסם בתמצית** · רשימת רכבים שלא ביצעו תיקון קריאת שירות יותר מחצי שנה ממכתב היבואן. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/hagbalat_recall)

**יצירת משאב לפי הקטלוג** · 2021-04-07.

**פרופיל חי** · 126 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה              | משמעות              | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                                                                                          |
| ---------------- | ------------------- | ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`            | מזהה שורת DataStore | int / number     | 0 / 0       | הושמט                                                                                                                                                                                                |
| `MISPAR_RECHEV`  | מספר רישוי          | numeric / number | 0 / 0       | הושמט                                                                                                                                                                                                |
| `RECALL_ID`      | מזהה קמפיין ריקול   | numeric / number | 0 / 0       | הושמט                                                                                                                                                                                                |
| `SUG_RECALL`     | סוג קריאה           | text / string    | 0 / 0       | 2 · `"תקלה סידרתית בטיחותית"`, `"קמפיין שרות טכני"`                                                                                                                                                  |
| `SUG_TAKALA`     | סוג תקלה            | text / string    | 0 / 0       | 11 · `"כריות אוויר"`, `"מנוע ומערכותיו"`, `"היגוי ומתלים"`, `"אחר"`, `"מרכב ושילדה"`, `"חשמל אליקטרוניקה ומיזוג"`, `"בלמים"`, `"מערכת הבטיחות"`, `"אביזרים"`, `"מערכת העברת כוח"`, `"חגורות בטיחות"` |
| `TEUR_TAKALA`    | תיאור תקלה          | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                |
| `TAARICH_PTICHA` | תאריך פתיחת ריקול   | text / string    | 0 / 0       | 72 · `"2015-11-09"`, `"2025-03-12"`, `"2011-12-26"`, `"2025-06-29"`, `"2026-03-08"`, `"2011-11-27"`, `"2024-11-03"`, `"2021-08-01"`                                                                  |

**JSON בפועל · 23/11/2026 13:01:30** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "RECALL_ID": 15781,
        "SUG_RECALL": "תקלה סידרתית בטיחותית",
        "SUG_TAKALA": "חשמל אליקטרוניקה ומיזוג",
        "TAARICH_PTICHA": "2024-12-03"
      },
      {
        "RECALL_ID": 12120,
        "SUG_RECALL": "תקלה סידרתית בטיחותית",
        "SUG_TAKALA": "כריות אוויר",
        "TAARICH_PTICHA": "2017-11-27"
      }
    ]
  }
}
```

<a id="resource-importers"></a>

### `importers` · יבואנים ומחירוני רכב חדש

**הגדרת המפרסם בתמצית** · מחירי דגמים חדשים שנמסרו בידי יבואנים. דגמים ממשיכים מתעדכנים פעם בשנה לפי תיאור המאגר. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/mehir_yevuan)

**יצירת משאב לפי הקטלוג** · 2021-05-13.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה             | משמעות                             | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                                                                                                |
| --------------- | ---------------------------------- | ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`           | מזהה שורת DataStore                | int / number     | 0 / 0       | הושמט                                                                                                                                                                                                      |
| `semel_yevuan`  | סמל יבואן                          | numeric / number | 0 / 0       | 1 · `1`                                                                                                                                                                                                    |
| `shem_yevuan`   | שם יבואן                           | text / string    | 0 / 0       | 1 · `"קרסו מוטורס בע\"מ"`                                                                                                                                                                                  |
| `sug_degem`     | סוג דגם                            | text / string    | 0 / 0       | 1 · `"P"`                                                                                                                                                                                                  |
| `tozeret_cd`    | קוד תוצר                           | numeric / number | 0 / 0       | 1 · `928`                                                                                                                                                                                                  |
| `tozeret_nm`    | שם תוצר                            | text / string    | 0 / 0       | 1 · `"רנו צרפת"`                                                                                                                                                                                           |
| `degem_cd`      | קוד דגם                            | numeric / number | 0 / 0       | 26 · `1000`, `4060`, `4061`, `4070`, `4071`, `4090`, `4091`, `4110`                                                                                                                                        |
| `degem_nm`      | שם דגם                             | text / string    | 0 / 0       | 26 · `"C0635P R TWINGO EP"`, `"L53A05 R19 RN 1.4I"`, `"L53A01 R19 RN.A1.4"`, `"L53A05 R19 RT 1.4I"`, `"L53A01 R19 RT.A1.4"`, `"L53805 R19 RTI 1.8"`, `"453F02 R19 RT A1.8"`, `"L53A05 R19RNDA 1.4"`        |
| `shnat_yitzur`  | שנת ייצור                          | numeric / number | 0 / 0       | 1 · `1996`                                                                                                                                                                                                 |
| `mehir`         | מחיר דגם חדש כפי שנמסר בידי היבואן | numeric / number | 0 / 0       | 18 · `67450`, `76950`, `61990`, `72450`, `92990`, `54950`, `70950`, `80950`                                                                                                                                |
| `kinuy_mishari` | כינוי מסחרי                        | text / string    | 0 / 0       | 25 · `"91 NR I4.1 5 דלתות"`, `"טווינגו 2.1 YSAE"`, `"91 NR I4.1 4 דלתות"`, `"91 אוטו AD.NR I4.1 4"`, `"91 3TR I4.1 4 דלתות"`, `"91 אוט' AD.TR I4.1 4"`, `"91 PH011 ITR 8.1 4 ד"`, `"91 אוט AD.TR I8.1 4ד"` |

**JSON בפועל · 23/11/2026 13:01:41** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "semel_yevuan": 1,
        "shem_yevuan": "קרסו מוטורס בע\"מ",
        "sug_degem": "P",
        "tozeret_cd": 928,
        "tozeret_nm": "רנו צרפת",
        "degem_cd": 1000,
        "degem_nm": "C0635P R TWINGO EP",
        "shnat_yitzur": 1996,
        "mehir": 54950,
        "kinuy_mishari": "טווינגו 2.1 YSAE"
      },
      {
        "semel_yevuan": 1,
        "shem_yevuan": "קרסו מוטורס בע\"מ",
        "sug_degem": "P",
        "tozeret_cd": 928,
        "tozeret_nm": "רנו צרפת",
        "degem_cd": 4060,
        "degem_nm": "L53A05 R19 RN 1.4I",
        "shnat_yitzur": 1996,
        "mehir": 61990,
        "kinuy_mishari": "91 NR I4.1 4 דלתות"
      }
    ]
  }
}
```

<a id="resource-disabledpermit"></a>

### `disabledPermit` · כלי רכב עם תג חניה לנכה

**הגדרת המפרסם בתמצית** · רשימת מספרי רכב המורשים לשאת תג חניה לנכה. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/rechev-tag-nachim)

**יצירת משאב לפי הקטלוג** · 2018-11-12.

**פרופיל חי** · 306 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                   | משמעות                        | DataStore / JSON | null / רווח | ערכים נצפים                                                                                          |
| --------------------- | ----------------------------- | ---------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `_id`                 | מזהה שורת DataStore           | int / number     | 0 / 0       | הושמט                                                                                                |
| `MISPAR RECHEV`       | מספר רישוי                    | numeric / number | 0 / 0       | הושמט                                                                                                |
| `TAARICH HAFAKAT TAG` | תאריך הפקת תג כחומר גלם מספרי | numeric / number | 0 / 0       | 246 · `20260816`, `20260809`, `20260621`, `20260726`, `20260630`, `20260803`, `20260224`, `20261025` |
| `SUG TAV`             | קוד סוג תג                    | numeric / number | 0 / 0       | 2 · `1`, `2`                                                                                         |

**JSON בפועל · 23/11/2026 13:01:42** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "TAARICH HAFAKAT TAG": 20230419,
        "SUG TAV": 1
      },
      {
        "TAARICH HAFAKAT TAG": 20241229,
        "SUG TAV": 1
      }
    ]
  }
}
```

<a id="resource-filters"></a>

### `filters` · כלי רכב שמותקנים בהם מסננים לצמצום פליטת מזהמים

**הגדרת המפרסם בתמצית** · מאגר רכב עם מסנן מותקן לצמצום פליטות, כולל התקינה ומועד ההתקנה. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/vehicles_filters_reduce_emissions)

**יצירת משאב לפי הקטלוג** · 2020-07-16.

**פרופיל חי** · 126 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                | משמעות              | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                          |
| ------------------ | ------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `_id`              | מזהה שורת DataStore | int / number     | 0 / 0       | הושמט                                                                                                                                |
| `mispar_rechev`    | מספר רישוי          | numeric / number | 0 / 0       | הושמט                                                                                                                                |
| `sug_rechev_EU_cd` | קוד קטגוריה אירופית | text / string    | 0 / 0       | 6 · `"N3"`, `"M3"`, `"M2"`, `"N2"`, `"N1"`, `"M1"`                                                                                   |
| `shnat_yitzur`     | שנת ייצור           | numeric / number | 0 / 0       | 15 · `2006`, `2005`, `2002`, `2003`, `2004`, `2001`, `2007`, `2000`                                                                  |
| `rishum_rishon_dt` | תאריך רישום ראשוני  | text / string    | 0 / 0       | 120 · `"2002-05-14"`, `"2005-09-26"`, `"2003-04-13"`, `"2005-08-02"`, `"2005-02-09"`, `"2004-09-02"`, `"2006-08-08"`, `"2005-02-28"` |
| `taarich_hatkana`  | תאריך התקנת המסנן   | text / string    | 0 / 0       | 79 · `"2018-08-14"`, `"2019-04-11"`, `"2019-07-07"`, `"2018-12-02"`, `"2019-11-05"`, `"2019-04-14"`, `"2019-03-07"`, `"2019-12-01"`  |

**JSON בפועל · 23/11/2026 13:01:52** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "sug_rechev_EU_cd": "N3",
        "shnat_yitzur": 2006,
        "rishum_rishon_dt": "2005-09-29",
        "taarich_hatkana": "2019-12-15"
      },
      {
        "sug_rechev_EU_cd": "N3",
        "shnat_yitzur": 1996,
        "rishum_rishon_dt": "1995-10-26",
        "taarich_hatkana": "2019-11-05"
      }
    ]
  }
}
```

<a id="resource-safetydiscount"></a>

### `safetyDiscount` · רכבים זכאים להנחה לאחר התקנת מערכות בטיחות

**הגדרת המפרסם בתמצית** · רשימת רכב שעומד בתנאים להנחה באגרת רישוי בגין התקנת מערכת בטיחות. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/zakaut-hatkana)

**יצירת משאב לפי הקטלוג** · 2018-11-06.

**פרופיל חי** · 126 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה             | משמעות                        | DataStore / JSON | null / רווח | ערכים נצפים                           |
| --------------- | ----------------------------- | ---------------- | ----------- | ------------------------------------- |
| `_id`           | מזהה שורת DataStore           | int / number     | 0 / 0       | הושמט                                 |
| `mispar_rechev` | מספר רישוי                    | numeric / number | 0 / 0       | הושמט                                 |
| `updated_dt`    | תאריך עדכון רשומה לפי שם השדה | text / string    | 0 / 0       | 1 · `"2026-11-23 04:07:56.080000000"` |

**JSON בפועל · 23/11/2026 13:02:00** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "updated_dt": "2026-11-23 04:07:56.080000000"
      },
      {
        "updated_dt": "2026-11-23 04:07:56.080000000"
      }
    ]
  }
}
```

<a id="resource-busfleet"></a>

### `busFleet` · ציי רכב אוטובוסים

**הגדרת המפרסם בתמצית** · צי השייך למפעילי אוטובוסים בתחבורה הציבורית, עם פרטי מפעיל, ייצור ונסועה. תדירות עדכון יומית מתועדת. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/bus_fleet)

**יצירת משאב לפי הקטלוג** · 2020-08-31.

**פרופיל חי** · 256 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                  | משמעות                 | DataStore / JSON | null / רווח | ערכים נצפים                                                                          |
| -------------------- | ---------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------ |
| `_id`                | מזהה שורת DataStore    | int / number     | 0 / 0       | הושמט                                                                                |
| `operator_nm`        | שם מפעיל               | text / string    | 0 / 0       | הושמט                                                                                |
| `cluster_nm`         | שם אשכול               | text / string    | 0 / 0       | הושמט                                                                                |
| `bus_license_id`     | מספר רישוי אוטובוס     | numeric / number | 0 / 0       | הושמט                                                                                |
| `stone_proof_nm`     | אינדיקציית מיגון אבנים | text / string    | 0 / 0       | הושמט                                                                                |
| `bullet_proof_nm`    | אינדיקציית מיגון ירי   | text / string    | 0 / 0       | הושמט                                                                                |
| `BusSize_nm`         | תיאור גודל אוטובוס     | text / string    | 0 / 0       | 3 · `"אוטובוס"`, `"מפרקי 4 דלתות"`, `"מיניבוס"`                                      |
| `BusType_nm`         | תיאור סוג אוטובוס      | text / string    | 0 / 0       | 2 · `"עירוני"`, `"בינעירוני"`                                                        |
| `SeatsNum`           | מספר מושבים            | numeric / number | 0 / 0       | 11 · `38`, `37`, `36`, `47`, `51`, `18`, `34`, `39`, `49`, `11`, `59`                |
| `production_year`    | שנת ייצור              | numeric / number | 0 / 0       | 10 · `2021`, `2025`, `2024`, `2016`, `2015`, `2022`, `2018`, `2017`, `2026`, `2009`  |
| `production_country` | ארץ ייצור              | text / string    | 0 / 0       | 4 · `"סין"`, `"שבדיה"`, `"גרמניה"`, `"טורקיה"`                                       |
| `PropulsionType_nm`  | סוג הנעה               | text / string    | 0 / 0       | 3 · `"דיזל"`, `"חשמל"`, `"גז טבעי דחוס"`                                             |
| `total_kilometer`    | נסועה כפי שדווחה בצי   | numeric / number | 0 / 0       | 256 · `254004`, `323972`, `285048`, `311484`, `254204`, `167424`, `296120`, `397399` |

**JSON בפועל · 23/11/2026 13:02:10** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "BusSize_nm": "אוטובוס",
        "BusType_nm": "בינעירוני",
        "SeatsNum": 59,
        "production_year": 2016,
        "production_country": "גרמניה",
        "PropulsionType_nm": "דיזל",
        "total_kilometer": 401284
      },
      {
        "BusSize_nm": "אוטובוס",
        "BusType_nm": "עירוני",
        "SeatsNum": 37,
        "production_year": 2009,
        "production_country": "שבדיה",
        "PropulsionType_nm": "דיזל",
        "total_kilometer": 392411
      }
    ]
  }
}
```

<a id="resource-anchors"></a>

### `anchors` · מאגר כלי רכב המחויבים בהתקנת נקודות עיגון לאבטחת מטענים

**הגדרת המפרסם בתמצית** · רשימת רכב מעל 3.5 טון שחידוש רישיונו כפוף לחובת נקודות עיגון, לפי תיאור המאגר. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/hatkana_nekudat_igun)

**יצירת משאב לפי הקטלוג** · 2021-05-23.

**פרופיל חי** · 126 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                | משמעות              | DataStore / JSON | null / רווח | ערכים נצפים                                                             |
| ------------------ | ------------------- | ---------------- | ----------- | ----------------------------------------------------------------------- |
| `_id`              | מזהה שורת DataStore | int / number     | 0 / 0       | הושמט                                                                   |
| `mispar_rechev`    | מספר רישוי          | numeric / number | 0 / 0       | הושמט                                                                   |
| `sug_rechev_EU_cd` | קוד קטגוריה אירופית | text / string    | 0 / 0       | 4 · `"N2"`, `"N3"`, `"O4"`, `"O3"`                                      |
| `mishkal_kolel`    | משקל כולל לפי המקור | numeric / number | 0 / 0       | 35 · `32000`, `7500`, `26000`, `9990`, `4536`, `9950`, `14990`, `40000` |

**JSON בפועל · 23/11/2026 13:02:18** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "sug_rechev_EU_cd": "N2",
        "mishkal_kolel": 12000
      },
      {
        "sug_rechev_EU_cd": "N2",
        "mishkal_kolel": 7500
      }
    ]
  }
}
```

<a id="resource-makers"></a>

### `makers` · קובץ תוצרים של כלי הרכב הפעילים

**הגדרת המפרסם בתמצית** · מילון תוצרים לכל סוגי הרכב הפעילים. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/tozeret)

**יצירת משאב לפי הקטלוג** · 2023-03-15.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                | משמעות              | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                       |
| ------------------ | ------------------- | ---------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `_id`              | מזהה שורת DataStore | int / number     | 0 / 0       | הושמט                                                                                                                             |
| `tozeret_cd`       | קוד תוצר            | numeric / number | 0 / 0       | 26 · `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`                                                                                       |
| `tozeret_nm`       | שם תוצר             | text / string    | 0 / 0       | 26 · `"א אי ל"`, `"א אי סי"`, `"א ו ס"`, `"אלברט בוקר"`, `"צ'אנג יאנג סין"`, `"ב מ וו איטליה"`, `"קינג לונג סין"`, `"אל.טי.איי."` |
| `tozar`            | שם תוצר ללא מדינה   | text / string    | 0 / 0       | 25 · `"אאודי"`, `"א אי ל"`, `"א אי סי"`, `"א ו ס"`, `"אלברט בוקר"`, `"צ'אנג יאנג"`, `"ב מ וו"`, `"קינג לונג"`                     |
| `tozeret_eretz_nm` | ארץ תוצר            | text / string    | 0 / 2       | 14 · `"איטליה"`, `"גרמניה"`, `"ישראל"`, `"בריטניה"`, `"סין"`, `"קנדה"`, `"צ'כיה"`, `"פורטוגל"`                                    |

**JSON בפועל · 23/11/2026 13:02:27** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "tozeret_cd": 1,
        "tozeret_nm": "א אי ל",
        "tozar": "א אי ל",
        "tozeret_eretz_nm": ""
      },
      {
        "tozeret_cd": 3,
        "tozeret_nm": "א ו ס",
        "tozar": "א ו ס",
        "tozeret_eretz_nm": ""
      }
    ]
  }
}
```

<a id="resource-campaigns"></a>

### `campaigns` · Recall

**הגדרת המפרסם בתמצית** · הודעות יצרנים על קריאות שירות בטיחותיות לפי קמפיין. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/recall)

**יצירת משאב לפי הקטלוג** · 2018-11-06.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה             | משמעות                   | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                                                                                                                                                                                                                |
| --------------- | ------------------------ | ---------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`           | מזהה שורת DataStore      | int / number     | 0 / 0       | הושמט                                                                                                                                                                                                                                                                                                                      |
| `RECALL_ID`     | מזהה קמפיין ריקול        | numeric / number | 0 / 0       | הושמט                                                                                                                                                                                                                                                                                                                      |
| `TOZAR_CD`      | קוד תוצר                 | numeric / number | 0 / 0       | 16 · `23`, `2`, `58`, `37`, `1`, `38`, `105`, `27`                                                                                                                                                                                                                                                                         |
| `TOZAR_TEUR`    | תיאור תוצר               | text / string    | 0 / 0       | 16 · `"FORD"`, `"MAZDA"`, `"YAMAHA"`, `"MAN"`, `"TOYOTA"`, `"MERCEDES BENZ"`, `"SUZUKI MOTORCYCLES"`, `"ISUZU TRUCKS"`                                                                                                                                                                                                     |
| `DEGEM`         | תיאור הדגם בקמפיין       | text / string    | 0 / 0       | 23 · `"MAN"`, `"3"`, `"TRANSIT"`, `"AVENSIS"`, `"VITO,VIANO"`, `"EXEL  SUZUK"`, `"TROOPER"`, `"MITSUBISHI  PAJERO"`                                                                                                                                                                                                        |
| `SHNAT_RECALL`  | שנת ריקול                | numeric / number | 0 / 0       | 5 · `2011`, `2008`, `2001`, `2003`, `2010`                                                                                                                                                                                                                                                                                 |
| `BUILD_BEGIN_A` | תחילת טווח ייצור בקמפיין | text / string    | 0 / 0       | 15 · `"2010-01-03"`, `"2008-01-01"`, `"2003-01-01"`, `"2000-01-02"`, `"1999-01-03"`, `"2009-08-02"`, `"2003-01-05"`, `"2009-01-01"`                                                                                                                                                                                        |
| `BUILD_END_A`   | סוף טווח ייצור בקמפיין   | text / string    | 0 / 0       | 15 · `"2010-12-31"`, `"2003-12-31"`, `"2008-12-31"`, `"2000-12-31"`, `"2006-12-31"`, `"2011-12-31"`, `"2004-12-31"`, `"2008-03-01"`                                                                                                                                                                                        |
| `SUG_RECALL`    | סוג קריאה                | text / string    | 0 / 0       | 2 · `"תקלה סידרתית בטיחותית"`, `"קמפיין שרות טכני"`                                                                                                                                                                                                                                                                        |
| `SUG_TAKALA`    | סוג תקלה                 | text / string    | 0 / 0       | 7 · `"בלמים"`, `"חשמל אליקטרוניקה ומיזוג"`, `"מנוע ומערכותיו"`, `"מערכת העברת כוח"`, `"מערכת הבטיחות"`, `"אביזרים"`, `"חגורות בטיחות"`                                                                                                                                                                                     |
| `TEUR_TAKALA`   | תיאור תקלה               | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                                                                                                                      |
| `OFEN_TIKUN`    | אופן תיקון               | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                                                                                                                      |
| `TKINA_EU`      | סיווג תקינה אירופית      | text / string    | 0 / 0       | 5 · `"M1"`, `"L1"`, `"M2"`, `"L2"`, `"N1"`                                                                                                                                                                                                                                                                                 |
| `YEVUAN_TEUR`   | תיאור היבואן             | text / string    | 0 / 0       | 12 · `"דלק מוטורס בעמ"`, `"מטרו מוטור שווק (1981) בעמ"`, `"יוניברסל מוטורס ישראל בעמ"`, `"מכשירי תנועה ומשאיות"`, `"דוד לובינסקי בעמ"`, `"יוניון מוטורס בעמ"`, `"כלמוביל מרצדס"`, `"אבניר חברה לרכב בעמ"`, `"כלמוביל מיצובישי"`, `"מאיר חברה למכוניות ומשאיות בע"`, `"קרסו מוטורס בעמ"`, `"יפנאוטו חברה ישראלית לרכב בעמ"` |
| `TELEPHONE`     | טלפון                    | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                                                                                                                      |
| `WEBSITE`       | אתר                      | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                                                                                                                      |

**JSON בפועל · 23/11/2026 13:02:29** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "RECALL_ID": 11020,
        "TOZAR_CD": 1,
        "TOZAR_TEUR": "TOYOTA",
        "DEGEM": "AVENSIS",
        "SHNAT_RECALL": 2011,
        "BUILD_BEGIN_A": "2000-01-02",
        "BUILD_END_A": "2008-12-31",
        "SUG_RECALL": "תקלה סידרתית בטיחותית",
        "SUG_TAKALA": "מנוע ומערכותיו",
        "TKINA_EU": "M1",
        "YEVUAN_TEUR": "יוניון מוטורס בעמ"
      },
      {
        "RECALL_ID": 11026,
        "TOZAR_CD": 38,
        "TOZAR_TEUR": "MERCEDES BENZ",
        "DEGEM": "VITO,VIANO",
        "SHNAT_RECALL": 2011,
        "BUILD_BEGIN_A": "2008-01-01",
        "BUILD_END_A": "2010-12-31",
        "SUG_RECALL": "קמפיין שרות טכני",
        "SUG_TAKALA": "חשמל אליקטרוניקה ומיזוג",
        "TKINA_EU": "M1",
        "YEVUAN_TEUR": "כלמוביל מרצדס"
      }
    ]
  }
}
```

<a id="resource-monthly"></a>

### `monthly` · כמות סגירות חודשי עבור רכבים חדשים בעלי קוד דגם

**הגדרת המפרסם בתמצית** · מסירות חודשיות של רכב חדש עם קוד דגם משנת 2018 ועד החודש הקודם. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/amount_monthly_closures_vehicles)

**יצירת משאב לפי הקטלוג** · 2019-12-24.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה             | משמעות                     | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                                                                                               |
| --------------- | -------------------------- | ---------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`           | מזהה שורת DataStore        | int / number     | 0 / 0       | הושמט                                                                                                                                                                                                     |
| `sgira_month`   | חודש סגירה או מסירה        | numeric / number | 0 / 0       | 1 · `201001`                                                                                                                                                                                              |
| `sug_degem`     | סוג דגם                    | text / string    | 0 / 0       | 1 · `"M"`                                                                                                                                                                                                 |
| `tozeret_cd`    | קוד תוצר                   | numeric / number | 0 / 0       | 11 · `603`, `301`, `413`, `187`, `650`, `139`, `177`, `481`, `496`, `634`, `712`                                                                                                                          |
| `tozeret_nm`    | שם תוצר                    | text / string    | 0 / 0       | 11 · `"מיצובישי תאילנ"`, `"פולקסווגן פולי"`, `"טויוטה יפן"`, `"טויוטה תאילנד"`, `"סובארו יפן"`, `"מזדה תאילנד"`, `"פיאט טורקיה"`, `"יונדאי קוריאה"`, `"סיטרואן ספרד"`, `"ניסאן ספרד"`, `"סאנגיונג ד.קור"` |
| `degem_cd`      | קוד דגם                    | numeric / number | 0 / 0       | 23 · `15`, `36`, `27`, `16`, `18`, `22`, `104`, `114`                                                                                                                                                     |
| `degem_nm`      | שם דגם                     | text / string    | 0 / 0       | 24 · `"2KBC43"`, `"UN8F12"`, `"223WXL1A"`, `"KUN26L-DRASYW"`, `"KUN25L-DRMDHW"`, `"2KJC43"`, `"2KJE43"`, `"2KBC42"`                                                                                       |
| `car_num`       | כמות כלי רכב בקבוצת הפילוח | numeric / number | 0 / 0       | 15 · `1`, `8`, `2`, `20`, `11`, `6`, `7`, `3`                                                                                                                                                             |
| `kinuy_mishari` | כינוי מסחרי                | text / string    | 0 / 0       | 15 · `"L200"`, `"HILUX"`, `"CADDY MAXI"`, `"CADDY KOMBI"`, `"CADDY"`, `"HIACE"`, `"BT-50"`, `"DOBLO"`                                                                                                     |

**JSON בפועל · 23/11/2026 13:02:30** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "sgira_month": 201001,
        "sug_degem": "M",
        "tozeret_cd": 139,
        "tozeret_nm": "מזדה תאילנד",
        "degem_cd": 15,
        "degem_nm": "UN8F12",
        "car_num": 20,
        "kinuy_mishari": "BT-50"
      },
      {
        "sgira_month": 201001,
        "sug_degem": "M",
        "tozeret_cd": 177,
        "tozeret_nm": "פיאט טורקיה",
        "degem_cd": 16,
        "degem_nm": "223WXL1A",
        "car_num": 31,
        "kinuy_mishari": "DOBLO"
      }
    ]
  }
}
```

<a id="resource-monthlynomodel"></a>

### `monthlyNoModel` · מאגר כמות כלי רכב חדשים חסרי קוד דגם

**הגדרת המפרסם בתמצית** · מסירות חודשיות של רכב חדש חסר קוד דגם משנת 2018 ועד החודש הקודם. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/kamut_sgirot_hodshi_rechev_blikoddegem)

**יצירת משאב לפי הקטלוג** · 2021-04-07.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה                  | משמעות                     | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                                       |
| -------------------- | -------------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                | מזהה שורת DataStore        | int / number     | 0 / 0       | הושמט                                                                                                                                             |
| `sgira_month`        | חודש סגירה או מסירה        | numeric / number | 0 / 0       | 1 · `201801`                                                                                                                                      |
| `kvutzat_sug_rechev` | קבוצת סוג רכב              | text / string    | 0 / 0       | 1 · `"אוטובוס"`                                                                                                                                   |
| `tozeret_cd`         | קוד תוצר                   | numeric / number | 0 / 0       | 8 · `358`, `361`, `593`, `531`, `101`, `120`, `204`, `446`                                                                                        |
| `tozeret_nm`         | שם תוצר                    | text / string    | 0 / 0       | 8 · `"יוטונג סין"`, `"וולבו שבדיה"`, `"מרצדס בנץ גרמנ"`, `"מאן גרמניה"`, `"איווקו איטליה"`, `"איסוזו טורקיה"`, `"סולאריס פולין"`, `"אוובוס ספרד"` |
| `degem_nm`           | שם דגם                     | text / string    | 0 / 0       | 26 · `"50C18"`, `"50C17"`, `"MOBELB"`, `"4122 - URBINO18LF"`, `"LION"`, `"ZK6129HQ"`, `"TIGER"`, `"PUMA IC"`                                      |
| `car_num`            | כמות כלי רכב בקבוצת הפילוח | numeric / number | 0 / 0       | 15 · `1`, `5`, `4`, `3`, `6`, `13`, `2`, `12`                                                                                                     |

**JSON בפועל · 23/11/2026 13:02:31** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "sgira_month": 201801,
        "kvutzat_sug_rechev": "אוטובוס",
        "tozeret_cd": 101,
        "tozeret_nm": "איווקו איטליה",
        "degem_nm": "50C18",
        "car_num": 13
      },
      {
        "sgira_month": 201801,
        "kvutzat_sug_rechev": "אוטובוס",
        "tozeret_cd": 101,
        "tozeret_nm": "איווקו איטליה",
        "degem_nm": "50C17",
        "car_num": 3
      }
    ]
  }
}
```

<a id="resource-electric"></a>

### `electric` · מאגר כמויות כלי רכב חשמליים לפי נפה

**הגדרת המפרסם בתמצית** · ספירה מצרפית של כלי רכב חשמליים פעילים לפי נפה. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/rechavim_hashmalim)

**יצירת משאב לפי הקטלוג** · 2023-05-11.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה        | משמעות                     | DataStore / JSON | null / רווח | ערכים נצפים                                                                                           |
| ---------- | -------------------------- | ---------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `_id`      | מזהה שורת DataStore        | int / number     | 0 / 0       | הושמט                                                                                                 |
| `baalut`   | בעלות נוכחית               | text / string    | 0 / 0       | 4 · `"פרטי"`, `"חברה"`, `"ליסינג"`, `"סוחר"`                                                          |
| `mahoz_nm` | שם מחוז                    | text / string    | 0 / 0       | 7 · `"המרכז"`, `"הצפון"`, `"תל אביב"`, `"חיפה"`, `"אזור יהודה ושומרון"`, `"הדרום"`, `"ירושלים"`       |
| `nafa_nm`  | שם נפה                     | text / string    | 0 / 0       | 17 · `"רחובות"`, `"תל אביב"`, `"רמלה"`, `"פתח תקווה"`, `"חיפה"`, `"אשקלון"`, `"באר שבע"`, `"ירושלים"` |
| `car_num`  | כמות כלי רכב בקבוצת הפילוח | numeric / number | 0 / 0       | 26 · `29346`, `21093`, `19732`, `16311`, `14738`, `14550`, `14107`, `13504`                           |

**JSON בפועל · 23/11/2026 13:02:33** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "baalut": "פרטי",
        "mahoz_nm": "תל אביב",
        "nafa_nm": "תל אביב",
        "car_num": 29346
      },
      {
        "baalut": "פרטי",
        "mahoz_nm": "המרכז",
        "nafa_nm": "פתח תקווה",
        "car_num": 21093
      }
    ]
  }
}
```

<a id="resource-garages"></a>

### `garages` · מוסכים ומכוני רישוי

**הגדרת המפרסם בתמצית** · ספר מוסכים ומכוני רישוי בפיקוח המשרד. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/musachim)

**יצירת משאב לפי הקטלוג** · 2018-11-06.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה               | משמעות                                              | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------- | ---------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`             | מזהה שורת DataStore                                 | int / number     | 0 / 0       | הושמט                                                                                                                                                                                                                             |
| `mispar_mosah`    | מספר מוסך                                           | numeric / number | 0 / 0       | הושמט                                                                                                                                                                                                                             |
| `shem_mosah`      | שם מוסך                                             | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                             |
| `cod_sug_mosah`   | קוד סוג מוסך                                        | numeric / number | 0 / 0       | 2 · `6`, `3`                                                                                                                                                                                                                      |
| `sug_mosah`       | תיאור סוג מוסך                                      | text / string    | 0 / 0       | 2 · `"מוסך מורשה"`, `"מוסך רישוי לציוד חקלאי"`                                                                                                                                                                                    |
| `ktovet`          | כתובת                                               | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                             |
| `yishuv`          | יישוב                                               | text / string    | 0 / 0       | 6 · `"זיקים"`, `"שובל"`, `"נירים"`, `"רביבים"`, `"ירושלים"`, `"יד מרדכי"`                                                                                                                                                         |
| `telephone`       | טלפון עסק                                           | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                             |
| `mikud`           | מיקוד                                               | numeric / number | 0 / 0       | הושמט                                                                                                                                                                                                                             |
| `cod_miktzoa`     | קוד מקצוע                                           | numeric / number | 0 / 0       | 14 · `10`, `20`, `23`, `190`, `194`, `192`, `143`, `135`                                                                                                                                                                          |
| `miktzoa`         | תיאור מקצוע                                         | text / string    | 0 / 0       | 14 · `"מכונאות רכב בנזין"`, `"מכונאות רכב דיזל"`, `"תיקון אחזקת רכב חשמלי/היברידי"`, `"טרקטורים ומכונות ניידות"`, `"תיקון מלגזות הרמה"`, `"אוטוטק טרקטורים ומכונות ניידות"`, `"רפידות ותופי בלם"`, `"אוטוטק תיקון והחלפת צמיגים"` |
| `menahel_miktzoa` | מנהל מקצועי                                         | text / string    | 0 / 0       | הושמט                                                                                                                                                                                                                             |
| `rasham_havarot`  | מזהה ברשם החברות לפי שם השדה                        | numeric / number | 0 / 0       | הושמט                                                                                                                                                                                                                             |
| `TESTIME`         | שדה תפעולי ששמו מופיע בסכמה. משמעות וקידוד לא אומתו | text / string    | 0 / 26      | —                                                                                                                                                                                                                                 |

**JSON בפועל · 23/11/2026 13:02:34** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "mispar_mosah": 16,
        "cod_sug_mosah": 6,
        "sug_mosah": "מוסך מורשה",
        "yishuv": "נירים",
        "cod_miktzoa": 10,
        "miktzoa": "מכונאות רכב בנזין",
        "rasham_havarot": 570005926,
        "TESTIME": ""
      },
      {
        "mispar_mosah": 16,
        "cod_sug_mosah": 6,
        "sug_mosah": "מוסך מורשה",
        "yishuv": "נירים",
        "cod_miktzoa": 20,
        "miktzoa": "מכונאות רכב דיזל",
        "rasham_havarot": 570005926,
        "TESTIME": ""
      }
    ]
  }
}
```

<a id="resource-dealers"></a>

### `dealers` · סוחרי רכב

**הגדרת המפרסם בתמצית** · ספר סוחרי רכב בפיקוח המשרד. [דף המאגר](https://data.gov.il/he/datasets/ministry_of_transport/socharim)

**יצירת משאב לפי הקטלוג** · 2018-09-02.

**פרופיל חי** · 26 שורות, כולל דף סכמה של 26. ספירת שורות זו יכולה לכלול כפילות בין הדפים.

| שדה       | משמעות                | DataStore / JSON | null / רווח | ערכים נצפים                                                                                                         |
| --------- | --------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `_id`     | מזהה שורת DataStore   | int / number     | 0 / 0       | הושמט                                                                                                               |
| `shem`    | שם עסק                | text / string    | 0 / 0       | הושמט                                                                                                               |
| `yishuv`  | יישוב                 | text / string    | 0 / 0       | 19 · `"תל אביב -יפו"`, `"חולון"`, `"פתח תקווה"`, `"אזור"`, `"ראשון לציון"`, `"מבשרת ציון"`, `"רמת גן"`, `"כפר סבא"` |
| `mikud`   | מיקוד                 | numeric / number | 0 / 0       | הושמט                                                                                                               |
| `ktovet`  | כתובת                 | text / string    | 0 / 0       | הושמט                                                                                                               |
| `het_pei` | מזהה חברה לפי שם השדה | text / string    | 0 / 26      | הושמט                                                                                                               |

**JSON בפועל · 23/11/2026 13:02:35** · הקרנה של עד שתי רשומות מהתגובה.

```json
{
  "success": true,
  "result": {
    "records": [
      {
        "yishuv": "מבשרת ציון"
      },
      {
        "yishuv": "רמת גן"
      }
    ]
  }
}
```

### סתירות, טיפוסים וגבולות ההצטרפות

| מקור א          | מקור ב          | מפתחות בחפיפה | 1:1 | VIN שונה / בר־השוואה | שנת ייצור | קוד תוצר | קוד דגם |
| --------------- | --------------- | ------------- | --- | -------------------- | --------- | -------- | ------- |
| private_cars_1  | private_cars_2  | 183           | 183 | 0/0                  | 0/0       | 0/183    | 0/183   |
| heavy           | publicTransport | 78            | 78  | 0/0                  | 0/78      | 0/78     | 0/0     |
| publicTransport | offRoad_1       | 2             | 2   | 0/0                  | 0/2       | 0/2      | 0/2     |

המכנה בכל עמודה כולל התאמות 1:1 ורק כאשר שני הצדדים מכילים ערך בר השוואה. קוד מספרי מאופס נורמל לפני השוואה. רצף שלדה קצר משישה תווים הוצא מההשוואה. קוד שונה עשוי לנבוע מקידוד מקור, ו־VIN שונה מעיד על סתירת זהות או על איכות נתונים נמוכה.

**דוגמת שלדה תואמת בין צמ״ה לכבד · 23/11/2026.** התקבלו 2 צמדי שורות עם ערך שלדה זהה, לאחר שאילתת המשך בשני המקורות. מפתח הצמ״ה ומספר הרישוי בחיתוך הזה שונים בדוגמה. תצוגת האתר יכולה לקשר רישומי מקור תוך שמירה על שני המזהים.

```json
{
  "heavy": {
    "tkina_EU": "T1",
    "shnat_yitzur": 2001,
    "tozeret_cd": 209,
    "tozeret_nm": "ג'ון דיר ארהב\"",
    "tozeret_eretz_nm": "ארהב\"",
    "sug_delek_cd": "2",
    "sug_delek_nm": "דיזל",
    "mishkal_kolel": 0,
    "mishkal_azmi": 0,
    "degem_nm": "8310",
    "nefach_manoa": 0,
    "degem_manoa": "__JD8310"
  },
  "cme": {
    "shilda_totzar_cd": 452,
    "shilda_totzar_en_nm": "JOHN DEERE",
    "shnat_yitzur": 2001,
    "sug_tzama_cd": 612,
    "sug_tzama_nm": "טרקטור חקלאי אופני",
    "hanaa_cd": 3,
    "hanaa_nm": "סולר",
    "rishum_date": "2001-04-19",
    "koah_sus": 257,
    "mishkal_ton": 0,
    "tokef_date": "2013-05-01",
    "mishkal_kolel_ton": 0
  }
}
```

**העשרת ריקול · 23/11/2026.** חיפוש הודעת יצרן לפי `RECALL_ID` מהשורה הראשונה של מאגר ההגבלות החזיר 1 רשומות.

```json
{
  "recall": {
    "RECALL_ID": 15781,
    "SUG_RECALL": "תקלה סידרתית בטיחותית",
    "SUG_TAKALA": "חשמל אליקטרוניקה ומיזוג",
    "TAARICH_PTICHA": "2024-12-03"
  },
  "campaigns": [
    {
      "RECALL_ID": 15781,
      "TOZAR_CD": 26,
      "TOZAR_TEUR": "HYUNDAI",
      "DEGEM": "SANTA FE",
      "SHNAT_RECALL": 2024,
      "BUILD_BEGIN_A": "2011-01-01",
      "BUILD_END_A": "2014-12-31",
      "SUG_RECALL": "תקלה סידרתית בטיחותית",
      "SUG_TAKALA": "חשמל אליקטרוניקה ומיזוג",
      "TKINA_EU": "M1"
    }
  ]
}
```

**הבדלי ייצוג שניתן לקודד מראש**

- `mispar_rechev` מספרי במרבית המקורות, וטקסט בשני ארכיוני ביטול. קודי תוצר, דגם, שנת ייצור ומשקל מופיעים גם כמחרוזות באותם ארכיונים. שמרו גם את הערך המקורי.
- מספר שלדה מופיע כ־`misgeret`, `mispar_shilda` או `shilda`. `_id` מופיע בכולם ומזהה שורה מקומית בלבד.
- `moed_aliya_lakvish` יכול לייצג חודש או ספרות אחרות לפי מקור; יש להחזיק את דיוק התאריך. `tokef_dt` ו־`bitul_dt` מייצגים אירועים שונים.
- נפח מנוע מופיע בין היתר כ־`nefach_manoa` ובדגמים כ־`nefah_manoa`. אבחנה דומה בין `delek_nm` ובין `sug_delek_nm`, ובין משפחות שדות מידות הצמיג.

<a id="design"></a>

## 6. כללי איחוד ותכנון ל־MyOto

### חוזה נתונים וקדימות

| נתון                      | מקור מוביל                                       | כלל הכרעה ותצוגה                                                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| זהות רכב                  | רישוי פעיל מהסוג המתאים                          | שמור מספר כפי שהתקבל ומזהה תחום נפרד לצמ״ה. זהה התאמה חזקה לפי מספר רישוי ושלדה תואמת כאשר שני המקורות מספקים שלדה. בסתירת שלדה שמור ישויות נפרדות וקשר מועמד לבדיקה.                                                                                                                                         |
| תוקף וביטול               | `tokef_dt` ממקור רישוי ו־`bitul_dt` ממקור ביטול  | תייג כל תאריך במפורש. הופעה ברשימת לא פעילים מצביעה על אוכלוסיית המאגר. הפקדה תוצג רק כשהמקור מספק אינדיקציה מפורשת. התאמה היסטורית מול מקור פעיל דורשת בירור זהות ותאריכים.                                                                                                                                  |
| מפרט רכב                  | הרשומה הייעודית לרכב, אחריה רשומת מפרט דגם מזוהה | מלא חסרים רק אחרי בדיקת מפתח. שדות כגון דלק, משקל ורמת גימור יכולים להיות שונים בין תצורת רכב מאושרת לבין פריט קטלוגי.                                                                                                                                                                                        |
| יצרן ודגם                 | רישוי, מילון תוצרים, קטלוג WLTP                  | הצג את קוד התוצר לצד שם מנורמל. חיבור דגם מועמד לפי `sug_degem + tozeret_cd + degem_cd + shnat_yitzur`. רמת גימור ודלק משמשים לאימות ולפתרון ריבוי התאמות. כינוי מסחרי לבדו מתאים לתצוגה ולחיפוש.                                                                                                             |
| היסטוריית בעלות ומבנה     | `history_1`, `history_2`                         | שמור אירועים ומיין באופן דטרמיניסטי. תאריכי בעלות ברמת רבעון, כמתואר בשירות הרשמי. נסועה היא מדידה בטסט האחרון שדווח. [שינויי מבנה](https://www.gov.il/he/Departments/DynamicCollectors/private_vehicle_history_1) · [בעלויות](https://www.gov.il/he/Departments/DynamicCollectors/private_vehicle_history_2) |
| ריקול                     | `recall` לפי רישוי ו־`campaigns` לפי מזהה קמפיין | התאם `RECALL_ID` לצורך הסבר ותיקון. התאמת יצרן/דגם/שנים לקמפיין היא אינדיקציה לבירור מול היבואן. תצוגת חוסר התאמה צריכה לציין את כיסוי מאגר ההגבלות.                                                                                                                                                          |
| תגים, מסננים, חובה וזכאות | הרשימות הייעודיות                                | הצג תצפית רשומה ומועד מקור. שמור ריבוי אם יש. הימנע מהסקת מצב בריאותי, זכאות נוכחית או עמידה בחובה מתוך עצם ההופעה ברשימה.                                                                                                                                                                                    |
| מחיר, שכיחות ומסירות      | `importers`, `modelCounts`, `monthly*`           | הצג מחיר דגם חדש כפי שמסר היבואן, ספירת מלאי פעיל/לא פעיל ומסירות חודשיות כמדדים נפרדים, עם הגדרת מכנה ומועד.                                                                                                                                                                                                 |
| צי אוטובוסים              | `busFleet`                                       | צרף לפי `bus_license_id` לאחר זיהוי אוטובוס. נסועה בצי ונסועה בטסט הן מדידות עם מקור ותאריך שונים.                                                                                                                                                                                                            |

שכבת המקור תשמור `resource_id`, זמן שליפה, זמן עדכון אם נמסר, מפתח, טיפוס וערך גולמי. שדה תצוגה יחזיק מקור וערך מנורמל. השתמש במצב `unknown` עבור ערך חסר ובמצב `conflicting` עבור ערכים סותרים. שמור `0` כתוצאה מספרית עד שיוגדר אחרת ברמת שדה. איחוד רשומות זהות נעשה לפי ערכי תוכן בלי `_id`. ריבוי בעלויות ואירועי ריקול נשמר לפי מפתח עסקי. אם מספר פריטים זהים התקבלו באותו רבעון, הצג את רמת הדיוק של המקור.

### סדר חיפוש מוצע

1. **רישוי רגיל**. כמסלול מהיר, בדוק רכב פרטי/מסחרי. בדוק ריקול לפי רישוי בכל תוצאה של רכב רגיל אם המוצר מציג מצב ריקול. כשנדרשת קביעה אמינה על מצב רישוי, בדוק את מקורות הסטטוס הרלוונטיים גם אם התקבלה תוצאה פעילה. אפשר להחזיר מפרט ראשוני בזמן שהבדיקות מתקדמות.
2. **הרחבה לפי סוג**. כשאין תוצאה מספקת, הרץ קבוצות קטנות של יבוא אישי, ציבורי, כבד ודו־גלגלי. כיסוי מלא של מספר לא מוכר כולל גם שני משאבי הלא־פעילים ושלושת משאבי הביטול. צמ״ה יקבל בורר חיפוש נפרד כברירת מחדל או תוצאה שמסומנת במפורש בתחום צמ״ה. לוחית בארכיון טקסט נבדקת בצורתה הגולמית ובווריאציות ריפוד שקיבלו אימות.
3. **העשרות מותנות**. המשך פרטי ורישומי היסטוריה לפי כיסוי פרטי, יבוא אישי כשצריך מסלול יבוא, צי אוטובוסים לאוטובוסים, עיגון למסחרי כבד, מסננים לסוגים רלוונטיים, ותג חניה לפי צורך מוצרי. העשרת דגם, מחירונים, ספירות וקמפיינים יכולה להגיע מעותק מקומי מתוארך.
4. **תקציב שאילתות**. קבץ לפי משאב ובקשות זהות, הגבֵל מקביליות, השתמש בהקרנת שדות וב־`include_total=false` כשאין צורך בספירה, ודפדף רק כשצריך. שמור תוצאות חיוביות בהתאם לתדירות המקור. שמור תוצאות ריקות לזמן קצר יותר. שגיאת ספק אינה תוצאה ריקה. החזר תוצאה חלקית עם סימון מקורות שלא נבדקו והשתמש ב־backoff וכיבוד `Retry-After` כשנמסר.
5. **רענון ובדיקות קבלה**. אמת סכמה ושמות מפתחות לפני שימוש במטען חדש. בדוק בכל רענון שיעור אפסים/ריקים, כפילויות, קטגוריות חדשות, ושינוי ב־Resource ID. בדיקות קבלה יכללו לפחות בעלות מרובה, לוחית ארכיון עם אפס מוביל, צמ״ה ורישוי בעלי אותן ספרות, ריקול לפי קמפיין, סתירת זהות, מקור כושל ושדה שמתקבל כמספר וכטקסט בין תקופות.

### שינויים שהמחקר מנמק לקראת השכתוב

- עצירה ב־`winner` מציגה רק מקור רישוי אחד. שרשרת `Promise.any` מחזירה רק ארכיון אחד, ומיזוג `records[0]` יכול להחליף ערך ב־null או לדרוס את ההקשר של מקור קודם. החזק תוצאות לפי מקור, והכרע לכל שדה במפורש. [גילוי והעשרה](https://github.com/mmichaelush/MyOto/blob/2fadf2ed47bfce2f0848407b361f6bbf1f355608/index.html#L230-L355)
- `heavy` מפעיל כיום צמ״ה וציבורי כמקורות העשרה לפי אותם ספרות. הזז צמ״ה לתחום זיהוי משלו והשתמש בהתאמת שלדה כשצריך לבדוק זהות משותפת. יש לטפל בתוצאות הנושאות תאריכים עם המפריד והדיוק של כל עמודה, ובפרט חודש עלייה ורבעון בעלות.
- נצל את מילון התוצרים, הודעות היצרן, חובת עיגון ומסירות חודשיות לפי מטרת המסך. במפרט דגם זמינים גם פרטי תקינה, מדדי WLTP ומערכות בטיחות. צרף את הנתונים לרשומת הדגם המתאימה ורק לאחר אימות היחידות ושיטת המדידה.
- בחר SDK או שירות קריאה שמפריד שגיאת רשת, תשובת HTTP, שגיאת DataStore ותוצאה ריקה. אפשר לצמצם רישום קלט גולמי ותגובות מלאות בצד לקוח. [מתאם JSONP הקיים](https://github.com/mmichaelush/MyOto/blob/2fadf2ed47bfce2f0848407b361f6bbf1f355608/index.html#L185-L226)

<a id="qa"></a>

## 7. דוח QA ופערים

- **מדגם עומק:** 8,630 שורות ו־**8,597 מפתחות כלי ייחודיים לפי תחום**. מהם 8,147 ערכי רישוי ו־450 מספרי צמ״ה. הספירה מנכה כפילויות מספריות בתוך תחום, ואינה אומדן למספר שלדות פיזיות.
- **אימות חיפוש חי חוזר לפי מפתח:** **8,597** מפתחות שנשלחו במסנן מדויק וחזרו במקור הדגימה, מהם 8,147 רישוי ו־450 צמ״ה. הצמ״ה נספר בתחום נפרד. דף הסכמה ובדיקות ממוקדות אינם נוספים לספירה הזאת.

- **הצלבה:** 701 מפתחות רישוי במטריצה, 19 מקורות רישוי ועוד חיפוש מספרי בתחום צמ״ה. **שלמות אצוות:** 0 זוגות מפתח–מקור ללא כיסוי, לאחר פיצול אצוות שנכשלו אם היה צורך.
- **בקשות שהגיעו לשלב HTTP או נרשמו בריצת המחקר:** 333 כולל 328 ל־DataStore, 3 ל־SQL ו־2 לקטלוג. קודים: `200` × 324, `404` × 9. ניסיון TLS ראשוני של Python נכשל מקומית לפני HTTP. הניסוי נמשך באמצעות curl עם אימות תעודה.

- **תזמון:** 23/11/2026 12:59:05 עד 23/11/2026 13:10:29 לפי זמני רישום תגובה. קצב סדרתי עם השהיה מזערית 0.7 שניות בין פעולות בריצה, ללא הצפה מקבילית. לא נעשה מבחן עומס.

- **קטלוג:** נסקרו 207 רשומות חבילה משני עמודים בקטלוג המשרד. 30 משאבי רכב קשורים נבדקו ב־DataStore. שירותי משרד נוספים נכללו לפי תחום ותכלית.

### חלוקת שליפות והיסטים

| משאב              | בקשות מסווגות | שורות עומק | מפתחות בעומק | אומתו שוב | מפתחות בחתך | מפתחות עם ריבוי | שורות מרבי למפתח בחתך | היסט × limit                                                   |
| ----------------- | ------------- | ---------- | ------------ | --------- | ----------- | --------------- | --------------------- | -------------------------------------------------------------- |
| private_cars_1    | 21            | 1900       | 1900         | 1900      | 183         | 0               | 1                     | 142355×380, 1537881×380, 2045759×380, 3316054×380, 3768778×380 |
| private_cars_2    | 17            | 1100       | 1100         | 1100      | 183         | 0               | 1                     | 204691×220, 1587228×220, 2281443×220, 3010543×220, 3596473×220 |
| personalImport    | 15            | 550        | 550          | 550       | 24          | 0               | 1                     | 973×110, 10062×110, 11879×110, 19149×110, 23393×110            |
| offRoad_1         | 15            | 570        | 570          | 570       | 176         | 0               | 1                     | 216860×114, 248413×114, 551035×114, 968349×114, 992683×114     |
| offRoad_2         | 18            | 180        | 180          | 180       | 23          | 0               | 1                     | 44132×36, 193200×36, 255693×36, 334911×36, 415152×36           |
| offRoad_3         | 18            | 180        | 180          | 180       | 23          | 0               | 1                     | 41011×36, 151587×36, 272535×36, 427151×36, 567573×36           |
| frozen_with_model | 15            | 540        | 540          | 540       | 39          | 0               | 1                     | 87238×108, 224920×108, 305083×108, 475868×108, 604604×108      |
| frozen_no_model   | 14            | 320        | 320          | 320       | 37          | 0               | 1                     | 135992×64, 512722×64, 681857×64, 1149633×64, 1191241×64        |
| heavy             | 15            | 680        | 680          | 680       | 156         | 0               | 1                     | 22407×136, 140530×136, 170313×136, 336903×136, 391220×136      |
| cme               | 14            | 450        | 450          | 450       | 16          | 0               | 1                     | 12335×90, 63075×90, 109202×90, 130662×90, 181492×90            |
| twoWheeled        | 15            | 600        | 600          | 600       | 36          | 0               | 1                     | 19607×120, 66474×120, 110456×120, 129359×120, 179445×120       |
| publicTransport   | 15            | 650        | 650          | 650       | 108         | 0               | 1                     | 6566×130, 25006×130, 32602×130, 47111×130, 55070×130           |
| history_1         | 7             | 0          | 0            | 0         | 93          | 0               | 1                     | —                                                              |
| history_2         | 7             | 0          | 0            | 0         | 93          | 37              | 13                    | —                                                              |
| modelDetails      | 1             | 0          | 0            | 0         | 0           | 0               | 0                     | —                                                              |
| modelCounts       | 1             | 0          | 0            | 0         | 0           | 0               | 0                     | —                                                              |
| recall            | 13            | 100        | 94           | 94        | 25          | 0               | 1                     | 18512×20, 33080×20, 65592×20, 91251×20, 101313×20              |
| importers         | 1             | 0          | 0            | 0         | 0           | 0               | 0                     | —                                                              |
| disabledPermit    | 14            | 280        | 273          | 273       | 53          | 1               | 2                     | 8482×56, 147541×56, 308204×56, 463000×56, 534359×56            |
| filters           | 13            | 100        | 100          | 100       | 25          | 0               | 1                     | 682×20, 2490×20, 3658×20, 5208×20, 5940×20                     |
| safetyDiscount    | 13            | 100        | 100          | 100       | 75          | 0               | 1                     | 108013×20, 416077×20, 632748×20, 796742×20, 1080419×20         |
| busFleet          | 13            | 230        | 230          | 230       | 44          | 0               | 1                     | 1391×46, 5632×46, 8335×46, 10790×46, 12750×46                  |
| anchors           | 13            | 100        | 100          | 100       | 45          | 0               | 1                     | 14544×20, 28504×20, 76967×20, 100915×20, 123506×20             |
| makers            | 1             | 0          | 0            | 0         | 0           | 0               | 0                     | —                                                              |
| campaigns         | 1             | 0          | 0            | 0         | 0           | 0               | 0                     | —                                                              |
| monthly           | 1             | 0          | 0            | 0         | 0           | 0               | 0                     | —                                                              |
| monthlyNoModel    | 1             | 0          | 0            | 0         | 0           | 0               | 0                     | —                                                              |
| electric          | 1             | 0          | 0            | 0         | 0           | 0               | 0                     | —                                                              |
| garages           | 1             | 0          | 0            | 0         | 0           | 0               | 0                     | —                                                              |
| dealers           | 1             | 0          | 0            | 0         | 0           | 0               | 0                     | —                                                              |

עמודת בקשות מסווגות כוללת את דפי הסכמה, דפי העומק, אצוות ההצלבה והאימות החוזר לפי מקור. הבקשות לקטלוג, ניסויי הקצה ובדיקות השלדה הייעודיות נכללות בסך הכללי. השורות בחתך כוללות את תוצאות המטריצה בלבד.

### גיוון המדגם

| משאב              | שורות | שנות ייצור בטווח סביר | שורות עם שנה זמינה | תוצרים או ארצות בצי | דגמים או סוג בצי |
| ----------------- | ----- | --------------------- | ------------------ | ------------------- | ---------------- |
| private_cars_1    | 1900  | 2001–2026             | 1900               | 98                  | 502              |
| private_cars_2    | 1100  | —                     | 0                  | 100                 | 371              |
| personalImport    | 550   | 1948–2026             | 550                | 82                  | 521              |
| offRoad_1         | 570   | 1951–2023             | 570                | 81                  | 268              |
| offRoad_2         | 180   | 1975–2009             | 180                | 32                  | 85               |
| offRoad_3         | 180   | 1983–2012             | 180                | 31                  | 95               |
| frozen_with_model | 540   | 1996–2018             | 540                | 62                  | 239              |
| frozen_no_model   | 320   | 1934–1999             | 320                | 16                  | 78               |
| heavy             | 680   | 1980–2026             | 680                | 86                  | 249              |
| cme               | 450   | 1956–2026             | 450                | 80                  | 299              |
| twoWheeled        | 600   | 1979–2026             | 600                | 46                  | 226              |
| publicTransport   | 650   | 2006–2026             | 650                | 38                  | 198              |
| recall            | 100   | —                     | 0                  | —                   | —                |
| disabledPermit    | 280   | —                     | 0                  | —                   | —                |
| filters           | 100   | 1993–2007             | 100                | —                   | —                |
| safetyDiscount    | 100   | —                     | 0                  | —                   | —                |
| busFleet          | 230   | —                     | 0                  | 4                   | 2                |
| anchors           | 100   | —                     | 0                  | —                   | —                |

### חריגות שאומתו ומגבלות

- **שינויים בזמן:** בבקשה חוזרת לחלק הראשון של אותו בלוק פרטי התקבלו 6/6 שורות זהות באותו סדר. הבדיקה החוזרת מכסה דקות אחדות בלבד. תאריכי משאבים וארכיונים אינם סדרת היסטוריית שינויים. שינוי יומי, מעבר סטטוס ומשך הישארות רשומה דורשים תמונות מצב בכמה ימים.

- **מצבי שגיאה:** חמש בדיקות קלט/משאב החזירו 404 עם HTML בסביבת הבדיקה. JSONP החזיר JavaScript עם קריאה ל־`myotoResearch(...)`. לכן לקוח צריך להתאים את פענוח הגוף לקוד ולסוג התוכן. `limit=50000` במדגם הריק הוחזר כמטא־דאטה, ותקרת שורות מעשית נשארה לא מאומתת.

- **כיסוי:** המדגם הגדול שימש לקריאה ולאימות מפתחות מול מקור המוצא. המטריצה הרוחבית בוצעה בתת־המדגם המפורט. אין בסיס להצגת אחוזי המטריצה כאומדן ארצי או לטענה שמקורות אינם יכולים לחפוף רק בגלל 0 במדגם.

- **דומיינים, יחידות ורישוי מידע:** חלק מהשדות מקודדים ללא מילון מלא שניתן לאמת במחקר. הערכים והחסרים מתועדים לפי מדגם. נדרשים מילון רשמי מלא, אימות יחידות פליטה/משקל/הספק, פירוש קודי תג ונתוני תקינה, ותנאי שימוש מתאימים לפני שימוש ציבורי רחב.

- **היקף רשימות:** מקורות מצרפיים ושירותים נלווים נוספו לפי שימוש ב־MyOto. הרישומים הגולמיים שהיו בתיקיית היעד לפני תחילת העבודה לא נכללו במניין, ולא צורפו פרטי רישוי גולמיים למסמך.

## אימות רישוי, נסועה ומנועים

- במרשם הפעיל עשויות להופיע רשומות עם תאריך תוקף שכבר חלף. `tokef_dt` מתאר את התוקף שדווח, ומקורות הביטול וההקפאה מתארים מצבי רישום נפרדים. מאגרי תחבורה ציבורית וכבדים עשויים להחזיר תשובות לאותה לוחית.
- ב־`history_2` מועד הבעלות זמין ברמת רבעון. משך בעלות בין אירועים הוא הערכה. סוג בעלות סוחר מוצג כחלק מההיסטוריה ומוחרג מספירת הידיים.
- ב־`history_1` מספר המנוע והקריאה האחרונה זמינים לאותה לוחית. הקריאה אינה כוללת תאריך מדידה. `rishum_rishon_dt` הוא מועד רישום ראשון.
- שלושת ארכיוני הביטול הסופי מחזירים במישרין קוד ותוצר מנוע, תוצר ודגם הרכב ותאריך ביטול. לספירות לפי קוד מנוע יש לשמור את הכיסוי של כל ארכיון ולהתייחס לשורות כרישומי ביטול.
- במאגר הרכב הכבד מספר מנוע ומספר שלדה נמצאים באותה רשומה. שינוי בין צילומי מצב חודשיים עם התאמת שלדה ולוחית מצביע על שינוי מספר מנוע בתקופה שבין הצילומים. תאריך החלפה וקילומטראז׳ בעת ההחלפה דורשים מקור אירוע מתאים.
