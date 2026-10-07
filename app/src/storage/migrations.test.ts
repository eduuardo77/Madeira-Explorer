/**
 * The migrations, run on a real SQLite (Node's own, 3.5x like the phone's).
 *
 *     cd app && npm test
 */

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { reconstructVisits } from '../progress/stampRules.ts';
import type { GeofenceCrossing } from '../progress/stampRules.ts';
import { MIGRATIONS } from './migrations.ts';

function migrated(upTo: number): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS.filter((each) => each.id <= upTo)) {
    for (const statement of migration.statements) db.exec(statement);
  }
  return db;
}

const run = (db: DatabaseSync, id: number) => {
  const migration = MIGRATIONS.find((each) => each.id === id);
  assert.ok(migration);
  for (const statement of migration.statements) db.exec(statement);
};

const minute = 60_000;

test('T-274: the repeated crossings go, and the visits stay exactly as they were', () => {
  const db = migrated(4);
  db.exec(`INSERT INTO trip (id, started_ts) VALUES (1, 0), (2, 0);`);
  const insert = db.prepare(
    'INSERT INTO geofence_event (trip_id, poi_id, ts, event_type) VALUES (?, ?, ?, ?)'
  );
  // Praia dos Reis Magos's shape on the P30, a second real visit, an exit
  // burst at a place never entered, a dwell, and the same place in another trip.
  const rows: [number, string, number, string][] = [
    [1, 'beach', 0, 'enter'], [1, 'beach', 2, 'enter'], [1, 'beach', 30, 'exit'],
    [1, 'beach', 31, 'exit'], [1, 'beach', 90, 'exit'], [1, 'beach', 120, 'enter'],
    [1, 'beach', 150, 'exit'], [1, 'beach', 400, 'exit'], [1, 'beach', 500, 'enter'],
    [1, 'far', 10, 'exit'], [1, 'far', 20, 'exit'],
    [1, 'park', 5, 'dwell'], [1, 'park', 6, 'dwell'], [1, 'park', 7, 'enter'],
    [2, 'beach', 0, 'exit'], [2, 'beach', 10, 'enter'],
  ];
  for (const [trip, poi, at, type] of rows) insert.run(trip, poi, at * minute, type);

  const crossings = (trip: number, poi: string): GeofenceCrossing[] =>
    (
      db
        .prepare('SELECT poi_id, ts, event_type FROM geofence_event WHERE trip_id = ? AND poi_id = ? ORDER BY ts, id')
        .all(trip, poi) as { poi_id: string; ts: number; event_type: GeofenceCrossing['eventType'] }[]
    ).map((row) => ({ geofenceId: row.poi_id, ts: row.ts, eventType: row.event_type }));
  const places: [number, string][] = [[1, 'beach'], [1, 'far'], [1, 'park'], [2, 'beach']];
  const asOf = 600 * minute;
  const before = places.map(([trip, poi]) => reconstructVisits(crossings(trip, poi), asOf));

  run(db, 5);

  const types = (trip: number, poi: string) => crossings(trip, poi).map((each) => each.eventType);
  assert.deepEqual(types(1, 'beach'), ['enter', 'exit', 'enter', 'exit', 'enter']);
  assert.deepEqual(types(1, 'far'), []);
  assert.deepEqual(types(1, 'park'), ['dwell', 'dwell', 'enter']);
  assert.deepEqual(types(2, 'beach'), ['enter']);
  assert.deepEqual(
    places.map(([trip, poi]) => reconstructVisits(crossings(trip, poi), asOf)),
    before
  );
});
