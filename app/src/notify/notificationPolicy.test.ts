/**
 * Tests for the notification budget (T-116, D-011).
 *
 *     cd app && npm test
 *
 * D-011 caps this app at **two notifications per trip, ever**, and the privacy
 * policy now promises it to the user in plain words (D-044): *"The app sends
 * two, ever."* A promise in shipped copy needs an enforcement stronger than
 * everyone remembering, so two things are pinned here:
 *
 *   1. **The arithmetic** — a third is refused, a repeat is refused, and a new
 *      trip starts with a full budget.
 *   2. **The door** — the last test reads the source of every module in `app/`
 *      and fails if anything except `sendTripNotification.ts` posts a
 *      notification. That is the one that will catch the regression, because
 *      the arithmetic will never be wrong; somebody will simply call Expo
 *      directly, three months from now, for a good reason.
 *
 * The same technique guards erase-all (`deleteAllUserData.test.ts` derives the
 * table list from the migrations rather than trusting a hand-written one). It
 * exists because a rule that lives only in a decision document is a rule the
 * compiler cannot help with.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_PER_TRIP,
  NOTIFICATION_KINDS,
  canNotify,
  parseSent,
  serialiseSent,
  type NotificationKind,
} from './notificationPolicy.ts';

// ---------------------------------------------------------------------------
// The arithmetic
// ---------------------------------------------------------------------------

test('the first two are allowed, in either order', () => {
  assert.equal(canNotify('health_check', []).allowed, true);
  assert.equal(canNotify('reveal', []).allowed, true);
  assert.equal(canNotify('reveal', ['health_check']).allowed, true);
  assert.equal(canNotify('health_check', ['reveal']).allowed, true);
});

test('the same notification is never sent twice', () => {
  // The common case, and not a bug: the health check runs at every launch and
  // trip end runs on every geofence crossing. Both rely on being told no.
  const decision = canNotify('health_check', ['health_check']);
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /already sent/);
});

test('a third notification is refused, whatever it claims to be', () => {
  // ⚠ The "budget spent" branch is **unreachable today** — with exactly two
  // kinds, any third request is caught by the "already sent" branch first. So
  // this simulates the only way it becomes reachable: somebody adds a third
  // kind. Casting a fake one is the honest way to exercise that, and writing
  // the test against the reachable branch instead would have looked like
  // coverage while testing nothing about the cap.
  const spent = ['health_check', 'reveal'] as NotificationKind[];
  const third = 'nudge' as NotificationKind;
  const decision = canNotify(third, spent);

  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /D-011/);
  assert.match(decision.reason, /budget spent/);
});

test('the cap and the list of kinds agree', () => {
  // If someone adds a kind, MAX_PER_TRIP must be argued about at the same
  // time, or the budget silently grows to fit.
  assert.equal(
    NOTIFICATION_KINDS.length,
    MAX_PER_TRIP,
    'a notification kind was added without changing the cap — see D-011'
  );
});

test('every refusal explains itself', () => {
  // The reason goes to the recorder's diary. "Why did I not get the reveal?"
  // has to be answerable months later, and a silent false is not an answer.
  for (const kind of NOTIFICATION_KINDS) {
    for (const sent of [[], [kind], [...NOTIFICATION_KINDS]] as NotificationKind[][]) {
      assert.ok(canNotify(kind, sent).reason.length > 0);
    }
  }
});

// ---------------------------------------------------------------------------
// The record in `app_state`
// ---------------------------------------------------------------------------

test('an empty or missing record means a full budget', () => {
  // A new trip, and the reset written when one starts.
  assert.deepEqual(parseSent(null), []);
  assert.deepEqual(parseSent(''), []);
  assert.deepEqual(parseSent('   '), []);
});

test('a hand-edited or corrupt record costs a notification, never a crash', () => {
  // `app_state` is a text column and this project has a debug screen. A bad
  // value must degrade, not throw on the recorder's path (D-010).
  assert.deepEqual(parseSent('health_check,nonsense'), ['health_check']);
  assert.deepEqual(parseSent('nonsense'), []);
  assert.deepEqual(parseSent('health_check,health_check'), ['health_check']);
  assert.deepEqual(parseSent(' reveal , health_check '), ['reveal', 'health_check']);
});

test('the record round-trips, in a stable order', () => {
  // Stable so the stored value does not churn between writes, which would
  // make the diary harder to read for no gain.
  assert.equal(serialiseSent(['reveal', 'health_check']), 'health_check,reveal');
  assert.equal(serialiseSent(['health_check', 'reveal']), 'health_check,reveal');
  assert.deepEqual(parseSent(serialiseSent(['reveal'])), ['reveal']);
  assert.equal(serialiseSent([]), '');
});

test('a spent budget survives a round trip and stays spent', () => {
  const stored = serialiseSent(['health_check', 'reveal']);
  assert.equal(canNotify('health_check', parseSent(stored)).allowed, false);
  assert.equal(canNotify('reveal', parseSent(stored)).allowed, false);
});

// ---------------------------------------------------------------------------
// The door
// ---------------------------------------------------------------------------

test('nothing except the one door posts a notification', () => {
  // ⚠ THE TEST THAT WILL ACTUALLY CATCH SOMETHING. The arithmetic above will
  // never be wrong; what will happen is that somebody calls Expo directly,
  // three months from now, for a perfectly good reason, and D-011 is repealed
  // without anyone deciding to repeal it.
  //
  // Reading permission state is fine and is not posting — only
  // `scheduleNotificationAsync` and friends are the door.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const srcRoot = path.resolve(here, '..');
  const door = path.join('notify', 'sendTripNotification.ts');

  const posting = /(schedule|present|dismissAll)NotificationAsync/;
  const offenders: string[] = [];

  for (const file of walk(srcRoot)) {
    if (file.endsWith(door) || file.endsWith('.test.ts')) {
      continue;
    }
    if (posting.test(readFileSync(file, 'utf8'))) {
      offenders.push(path.relative(srcRoot, file));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `these post notifications without going through ${door} (D-011, T-116): ${offenders.join(', ')}`
  );
});

test('the door itself really does post, so the check above is not vacuous', () => {
  // Probe check. If `sendTripNotification.ts` stopped calling Expo — renamed,
  // refactored, stubbed — the test above would pass by finding nothing
  // anywhere, which looks exactly like success. This project has been caught
  // by a probe that silently matched nothing before.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(path.join(here, 'sendTripNotification.ts'), 'utf8');

  assert.match(source, /scheduleNotificationAsync/);
  assert.match(source, /canNotify/);
});

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      found.push(full);
    }
  }
  return found;
}
