/**
 * Tests for the donated walk (OD-11, D-069).
 *
 *     cd app && npm test
 *
 * ⚠ **Most of these are privacy tests, and they are the point.** The sentence
 * this feature rests on — *"it contains your walk and what the app decided, and
 * nothing that identifies you"* — has to be literally true, and the way it stops
 * being true is somebody adding a helpful field. So the payload is asserted
 * field by field: what is in it, and what must never be.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWalkReport,
  describeWalkReport,
  renderWalkReport,
  walkReportFilename,
  WALK_REPORT_SCHEMA,
  type WalkReportInput,
} from './walkReport.ts';

const T0 = 1_800_000_000_000;

function input(overrides: Partial<WalkReportInput> = {}): WalkReportInput {
  return {
    fixes: [
      { ts: T0 + 60_000, lat: 32.75, lon: -16.95, accuracy_m: 8 },
      { ts: T0, lat: 32.74, lon: -16.94, accuracy_m: 12 },
    ],
    decisions: [
      {
        placeId: 'levada-do-rei',
        category: 'levada',
        awarded: false,
        reason: 'walked 1.6 km of 4.8 km (33%) — enough to ask, not enough to award',
        confidence: 0.33,
        dwellSeconds: null,
        meanSpeedMps: 0.7,
      },
    ],
    appVersion: '1.0.0',
    thresholds: { corridorM: 60, walkedMinutes: 45 },
    ...overrides,
  };
}

test('the report carries the walk and the decisions, in time order', () => {
  const report = buildWalkReport(input());
  assert.equal(report.schema, WALK_REPORT_SCHEMA);
  assert.equal(report.fixCount, 2);
  assert.equal(report.fixes[0].ts, T0, 'fixes must be sorted');
  assert.equal(report.startedTs, T0);
  assert.equal(report.endedTs, T0 + 60_000);
  assert.equal(report.decisions[0].placeId, 'levada-do-rei');
});

test('⚠ nothing in the payload identifies the walker or the phone', () => {
  // The whole feature rests on this being true. A new field that fails this
  // test is a new sentence somebody has to be told, and probably a new store
  // declaration (T-120, T-122).
  const json = renderWalkReport(buildWalkReport(input()));
  const banned = [
    'deviceId', 'installId', 'userId', 'uuid', 'email', 'name',
    'model', 'os', 'ip', 'locale', 'timezone', 'advertising',
  ];
  for (const field of banned) {
    assert.ok(
      !new RegExp(`"${field}"`, 'i').test(json),
      `the report must not carry ${field}`
    );
  }

  // And the keys it does carry are exactly these.
  assert.deepEqual(Object.keys(JSON.parse(json)).sort(), [
    'appVersion', 'decisions', 'endedTs', 'fixCount', 'fixes', 'note',
    'schema', 'startedTs', 'thresholds',
  ]);
});

test('a refused walk is carried, not filtered out', () => {
  // The refusals are the valuable half: somebody walked a levada and the app
  // said nothing. Dropping them would leave only the cases that worked.
  const report = buildWalkReport(input());
  assert.equal(report.decisions[0].awarded, false);
  assert.match(report.decisions[0].reason, /enough to ask/);
});

test('the thresholds travel with it, so an old report is still readable', () => {
  const report = buildWalkReport(input());
  assert.equal(report.thresholds.walkedMinutes, 45);
  assert.equal(report.appVersion, '1.0.0');
});

test('an empty note is null, never an empty string in the file', () => {
  assert.equal(buildWalkReport(input({ note: '   ' })).note, null);
  assert.equal(buildWalkReport(input({ note: ' turned back at the waterfall ' })).note,
    'turned back at the waterfall');
});

test('the description says what is in it, and counts what it says', () => {
  const description = describeWalkReport(buildWalkReport(input()));
  assert.match(description, /2 location points/);
  assert.match(description, /1 place\b/);
  assert.match(description, /Where you slept has been removed/);
  assert.match(description, /nothing\s+that identifies you/);
});

test('a walk with no fixes is still describable rather than a crash', () => {
  const report = buildWalkReport(input({ fixes: [] }));
  assert.equal(report.startedTs, null);
  assert.equal(walkReportFilename(report), 'madeira-walk.json');
  assert.match(describeWalkReport(report), /0 location points/);
});

test('the filename is dated from the walk, not from when it was sent', () => {
  const report = buildWalkReport(input());
  assert.match(walkReportFilename(report), /^madeira-walk-\d{4}-\d{2}-\d{2}\.json$/);
});
