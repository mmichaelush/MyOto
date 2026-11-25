function csvCell(value: string | number) {
  if (typeof value === 'number') return String(value);
  const safe = /^[\s]*[=+@\-\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function csvBlob(rows: readonly (readonly (string | number)[])[]) {
  return new Blob(
    ['\ufeff', rows.map((row) => row.map(csvCell).join(',')).join('\r\n')],
    {
      type: 'text/csv;charset=utf-8',
    },
  );
}
