import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';

test('compares dated snapshots in the same month without exposing vehicle identifiers', () => {
  const directory = mkdtempSync(join(tmpdir(), 'myoto-private-history-'));
  try {
    const capture = (day, isLater) => {
      const path = join(directory, day + '.sqlite');
      const db = new DatabaseSync(path);
      try {
        db.exec(`
          CREATE TABLE capture (month TEXT, observedAt TEXT);
          CREATE TABLE observations (
            plate INTEGER, vin TEXT, maker TEXT, model TEXT, engineModel TEXT,
            testDate TEXT, engine TEXT, odometer INTEGER
          );
        `);
        db.prepare('INSERT INTO capture VALUES (?, ?)').run(
          '2026-11',
          `2026-11-${day}T08:00:00Z`,
        );
        const add = db.prepare(
          'INSERT INTO observations VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        for (let index = 0; index < 25; index++) {
          add.run(
            100000 + index,
            `IDENTITY-${index}`,
            'Example',
            'Sedan',
            'MODEL-A',
            '2026-10-15',
            isLater && index < 5 ? 'REPLACEMENT' : 'ORIGINAL',
            50_000,
          );
        }
      } finally {
        db.close();
      }
      return path;
    };
    const before = capture('24', false);
    const after = capture('25', true);
    const output = join(directory, 'summary.json');
    execFileSync(process.execPath, [
      'scripts/compare-private-history.mjs',
      before,
      after,
      output,
    ]);
    const json = readFileSync(output, 'utf8');
    expect(JSON.parse(json)).toMatchObject({
      fromDate: '2026-11-24T08:00:00Z',
      toDate: '2026-11-25T08:00:00Z',
      comparable: 25,
      changed: 5,
      byModel: [{ engineModel: 'MODEL-A', changed: 5, observedKm: 50_000 }],
    });
    expect(json).not.toMatch(/IDENTITY-|REPLACEMENT|ORIGINAL|100000/);

    const local = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/inspect-private-history.mjs',
          '--report',
          '100000',
          after,
          before,
        ],
        { encoding: 'utf8' },
      ),
    );
    expect(local.readings).toMatchObject([
      { testDate: '2026-10-15', kilometers: 50_000 },
    ]);
    expect(local.engineChanges).toHaveLength(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
