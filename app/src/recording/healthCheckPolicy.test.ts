/**
 * Tests for the day-1 health check (T-049, D-011).
 *
 *     cd app && npm test
 *
 * The asymmetry is what is being pinned down. A missed alarm costs somebody
 * their holiday's record; a false alarm costs their trust, and the fix they
 * reach for makes things worse. So an alarm needs positive evidence, and the
 * ambiguous cases — chiefly a stationary phone on a quiet first evening —
 * must stay quiet.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideHealthCheck,
  HEALTH_CHECK_DELAY_MS,
  MIN_HEALTHY_FIX_COUNT,
  type HealthCheckInput,
} from './healthCheckPolicy.ts';

const INSTALLED = 1_800_000_000_000;
const AFTER = INSTALLED + HEALTH_CHECK_DELAY_MS + 60_000;

/** A healthy recorder, fourteen hours in. Each test bends one thing. */
function healthy(overrides: Partial<HealthCheckInput> = {}): HealthCheckInput {
  return {
    installedTs: INSTALLED,
    now: AFTER,
    alreadySent: false,
    permission: 'always',
    isRecording: true,
    fixCount: 240,
    lastFixTs: AFTER - 5 * 60_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// timing — it fires once, and not before it is useful
// ---------------------------------------------------------------------------

test('nothing is said before the window', () => {
  const decision = decideHealthCheck(
    healthy({ now: INSTALLED + 3 * 3600_000 })
  );
  assert.equal(decision.notify, false);
  assert.match(decision.reason, /too early/);
});

test('it fires at most once', () => {
  assert.equal(decideHealthCheck(healthy({ alreadySent: true })).notify, false);
});

test('a healthy recorder still gets its confirmation (D-011)', () => {
  // D-011 promises reassurance, not just warning. A check that only ever
  // appears when something is broken teaches people to dread it.
  const decision = decideHealthCheck(healthy());

  assert.equal(decision.notify, true);
  assert.match(decision.reason, /healthy/);
  assert.match(decision.title ?? '', /filling in nicely/);
});

// ---------------------------------------------------------------------------
// the failures worth interrupting somebody's holiday for
// ---------------------------------------------------------------------------

test('permission denied is reported, and says what to do', () => {
  const decision = decideHealthCheck(
    healthy({ permission: 'denied', fixCount: 0, lastFixTs: null })
  );

  assert.equal(decision.notify, true);
  assert.match(decision.reason, /denied/);
  assert.match(decision.body ?? '', /turn location back on/i);
});

test('permission never granted is a different, gentler message', () => {
  const decision = decideHealthCheck(
    healthy({ permission: 'undetermined', isRecording: false, fixCount: 0, lastFixTs: null })
  );

  assert.equal(decision.notify, true);
  assert.match(decision.title ?? '', /One tap/);
});

test('recording stopped is reported', () => {
  const decision = decideHealthCheck(healthy({ isRecording: false }));

  assert.equal(decision.notify, true);
  assert.match(decision.reason, /not recording/);
});

test('THE CASE THIS EXISTS FOR: running, permitted, and no fixes', () => {
  // The OEM battery killer (ARCHITECTURE §6.2). The app believes it is
  // working. Nothing else in the system would ever notice.
  const decision = decideHealthCheck(
    healthy({ fixCount: 0, lastFixTs: null })
  );

  assert.equal(decision.notify, true);
  assert.match(decision.title ?? '', /not filling in/);
});

test('too few fixes over fourteen hours is the same alarm', () => {
  const decision = decideHealthCheck(
    healthy({ fixCount: MIN_HEALTHY_FIX_COUNT - 1 })
  );

  assert.equal(decision.notify, true);
  assert.match(decision.reason, /fixes since install/);
});

test('a long silence from an otherwise healthy recorder is reported', () => {
  const decision = decideHealthCheck(
    healthy({ lastFixTs: AFTER - 10 * 3600_000 })
  );

  assert.equal(decision.notify, true);
  assert.match(decision.reason, /last fix 10h ago/);
});

// ---------------------------------------------------------------------------
// the false alarms it must not raise
// ---------------------------------------------------------------------------

test('a quiet evening in the hotel is NOT an alarm', () => {
  // Plenty of fixes from the day, then a few hours stationary while the
  // sampling gate does exactly what T-034 built it to do.
  const decision = decideHealthCheck(
    healthy({ fixCount: 180, lastFixTs: AFTER - 2 * 3600_000 })
  );

  assert.match(decision.reason, /healthy/);
  assert.match(decision.title ?? '', /nicely/);
});

test('While-Using is a supported mode, not a fault (D-008)', () => {
  // D-008 is explicit that the app is fully functional on While-Using. Warning
  // about it would contradict the permission strategy outright.
  const decision = decideHealthCheck(healthy({ permission: 'while_using' }));

  assert.match(decision.reason, /healthy/);
});

test('every decision explains itself, notifying or not', () => {
  const cases: HealthCheckInput[] = [
    healthy(),
    healthy({ alreadySent: true }),
    healthy({ now: INSTALLED }),
    healthy({ permission: 'denied' }),
    healthy({ fixCount: 0, lastFixTs: null }),
  ];

  for (const input of cases) {
    const decision = decideHealthCheck(input);
    assert.ok(decision.reason.length > 0);
    // A notification without words would be worse than none at all.
    if (decision.notify) {
      assert.ok((decision.title ?? '').length > 0);
      assert.ok((decision.body ?? '').length > 0);
    }
  }
});
