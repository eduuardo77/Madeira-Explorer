/**
 * Saving the trip to a file and restoring it (2026-10-04).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { backupFileName, checkBackup, USER_TABLES } from './backupPolicy.ts';
import { MIGRATIONS } from './migrations.ts';

test('⚠ every table a migration creates is in the backup, except the migration log', () => {
  const created = new Set<string>();
  for (const migration of MIGRATIONS) {
    for (const statement of migration.statements) {
      const match = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i.exec(statement);
      if (match !== null) created.add(match[1]);
    }
  }
  created.delete('schema_migration');
  assert.ok(created.size >= 8, `found ${created.size} tables: is the probe matching anything?`);
  assert.deepEqual([...created].sort(), [...USER_TABLES].sort());
});

test('trip comes first: every other table refers to it', () => {
  assert.equal(USER_TABLES[0], 'trip');
});

test('the file is named for the app and the day', () => {
  assert.equal(backupFileName(new Date(2026, 9, 4, 20, 30).getTime()), 'bruma-2026-10-04.db');
});

test('a file without our tables is not a backup', () => {
  assert.deepEqual(checkBackup(['photos'], [], [1, 2]), { ok: false, reason: 'not-a-backup' });
});

test('a backup from a newer app is refused; an older one is brought forward', () => {
  const tables = ['schema_migration', 'trip', 'raw_fix'];
  assert.deepEqual(checkBackup(tables, [1, 2, 3, 4], [1, 2, 3]), { ok: false, reason: 'newer-app' });
  assert.deepEqual(checkBackup(tables, [1, 2], [1, 2, 3]), { ok: true, missingMigrations: [3] });
  assert.deepEqual(checkBackup(tables, [1, 2, 3], [1, 2, 3]), { ok: true, missingMigrations: [] });
});
