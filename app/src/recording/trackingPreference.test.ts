/**
 * Tests for the tracking preferences (T-146, D-108).
 *
 *     cd app && npm test
 *
 * An unrecognised stored value must never leave the recorder in a worse state
 * than a fresh install.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as preference from './trackingPreference.ts';
import { DEFAULT_BACKGROUND_TRACKING, parseBackgroundTracking } from './trackingPreference.ts';

test('background recording is off only when it says so explicitly', () => {
  assert.equal(parseBackgroundTracking('false'), false);
  assert.equal(parseBackgroundTracking('0'), false);

  // ⚠ Everything else, including unreadable values, is the default. A
  // preference the app cannot parse must not silently opt the user out of the
  // feature they installed it for.
  for (const raw of [null, '', 'true', 'yes', 'nonsense']) {
    assert.equal(parseBackgroundTracking(raw), DEFAULT_BACKGROUND_TRACKING);
  }
});

test('⚠ there is one recording mode (D-108)', () => {
  // The three tiers recorded the route the same within 0 to 2 points. If a
  // second mode comes back, it needs a measurement that it draws a visibly
  // better line, not just a different number in a table.
  assert.deepEqual(Object.keys(preference).sort(), ['DEFAULT_BACKGROUND_TRACKING', 'parseBackgroundTracking']);
});
