/**
 * "End trip" stops the recorder before it closes the trip (T-204).
 *
 *     cd app && npm test
 *
 * A source check, because the order is the invariant and the calls are all
 * impure: close the trip first and the next fix opens a new, empty trip.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

test('⚠ T-204: automatic recording is off before the trip is closed', () => {
  const source = readFileSync(path.join(here, 'finishTrip.ts'), 'utf8');
  const body = source.slice(source.indexOf('export async function finishTrip'));
  const off = body.indexOf('applyBackgroundTrackingChange(false)');
  const pref = body.indexOf('setBackgroundTrackingAllowed(false)');
  const end = body.indexOf('endTripByUser(');
  assert.ok(off > 0 && pref > 0 && end > 0, 'all three steps are there');
  assert.ok(pref < end && off < end, 'recording stops first');
});

test('⚠ T-204: a manual end sends no reveal notification', () => {
  const source = readFileSync(path.join(here, '..', 'progress', 'tripEndDetection.ts'), 'utf8');
  const start = source.indexOf('export async function endTripByUser');
  const body = source.slice(start, source.indexOf('\n}\n', start));
  assert.equal(body.includes('sendReveal'), false);
  assert.ok(body.includes("'manual'"));
});
