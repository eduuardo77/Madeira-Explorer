/**
 * A structural guard on "Delete all my data" (T-125, D-010).
 *
 *     cd app && npm test
 *
 * WHY THIS TEST READS SOURCE FILES
 * --------------------------------
 * Unusual, and deliberate. `deleteAllUserData` cannot be unit-tested without a
 * database, but the bug it actually suffered was not behavioural — it was a
 * *list that fell out of date*. `stamp_award` was added in migration 2 and
 * never added to the delete order, and because `foreign_keys` is ON with no
 * `ON DELETE CASCADE`, that does not leave stray rows behind: it aborts the
 * whole transaction on a foreign-key violation, so **nothing is deleted at
 * all**, for exactly the users who have something to erase.
 *
 * That failure is invisible until somebody with a stamp taps the button, and
 * the button is the one control this app must never get wrong — there is no
 * cloud, no account and no support channel to fix it afterwards (D-001).
 *
 * So the invariant is checked where it lives: every table declaring
 * `REFERENCES trip(id)` in the migrations must be deleted, before `trip`, in
 * `deleteAllUserData`. Adding a child table without updating the delete order
 * now fails here instead of on somebody's phone.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = readFileSync(path.join(here, 'migrations.ts'), 'utf8');
const database = readFileSync(path.join(here, 'database.ts'), 'utf8');

/** Table names that carry a foreign key to `trip`. */
function childTablesOfTrip(): string[] {
  const tables: string[] = [];
  // `CREATE TABLE x (` … up to the closing `);`
  const createRe = /CREATE TABLE (\w+)\s*\(([\s\S]*?)\);/g;
  let match: RegExpExecArray | null;
  while ((match = createRe.exec(migrations)) !== null) {
    const [, name, body] = match;
    if (/REFERENCES\s+trip\s*\(/.test(body)) {
      tables.push(name);
    }
  }
  return tables;
}

/** The `DELETE FROM x` statements inside deleteAllUserData, in order. */
function deleteOrder(): string[] {
  const start = database.indexOf('export async function deleteAllUserData');
  assert.notEqual(start, -1, 'deleteAllUserData not found — was it renamed?');
  const body = database.slice(start);
  const end = body.indexOf('\n}');
  const scope = body.slice(0, end === -1 ? undefined : end);

  const deletes: string[] = [];
  const deleteRe = /DELETE FROM (\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = deleteRe.exec(scope)) !== null) {
    deletes.push(match[1]);
  }
  return deletes;
}

test('the migrations really do declare children of trip', () => {
  // Guards the guard: if the regex stops matching, every assertion below
  // would pass vacuously.
  const children = childTablesOfTrip();
  assert.ok(children.length >= 4, `found only ${children.join(', ')}`);
  assert.ok(children.includes('raw_fix'));
  assert.ok(children.includes('stamp_award'), 'the table that caused the bug');
});

test('EVERY table referencing trip is deleted by erase-all', () => {
  const deletes = deleteOrder();
  for (const table of childTablesOfTrip()) {
    assert.ok(
      deletes.includes(table),
      `${table} references trip but deleteAllUserData never deletes it — ` +
        'erase-all will abort on a foreign-key violation and delete nothing'
    );
  }
});

test('every child is deleted BEFORE trip', () => {
  const deletes = deleteOrder();
  const tripIndex = deletes.indexOf('trip');
  assert.notEqual(tripIndex, -1, 'trip itself must be deleted');

  for (const table of childTablesOfTrip()) {
    assert.ok(
      deletes.indexOf(table) < tripIndex,
      `${table} is deleted after trip, which violates the foreign key`
    );
  }
});

test('erase-all reclaims the disk space', () => {
  // "If a user asks us to delete their location history, the bytes should
  // actually go" — deleted pages stay in the file without this.
  assert.match(database.slice(database.indexOf('deleteAllUserData')), /VACUUM/);
});
