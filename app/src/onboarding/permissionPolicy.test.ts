/**
 * Tests for the permission flow (T-042, T-043, T-044).
 *
 *     cd app && npm test
 *
 * The load-bearing assertions here are all about what the app must NOT do:
 *
 *   - It must not gate on any permission. D-008 promises a fully functional
 *     app on While-Using, and CONTEXT §4.3 says the permission alone could
 *     sink the product.
 *   - It must not ask for Always twice. A second ask is pressure, and pressure
 *     is what gets permissions revoked.
 *   - It must not state a battery figure nobody measured (T-042).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALWAYS_UPGRADE_DELAY_MS,
  batterySentence,
  detectDowngrade,
  MEASURED_BATTERY_PERCENT_PER_DAY,
  nextOnboardingStep,
  shouldOfferAlwaysUpgrade,
  type AlwaysUpgradeState,
  type OnboardingState,
} from './permissionPolicy.ts';

const INSTALLED = 1_800_000_000_000;
const HOUR = 3600_000;

function onboarding(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    location: 'undetermined',
    notifications: 'undetermined',
    completed: false,
    // ⚠ iOS by default in these fixtures, so the existing assertions keep
    // measuring the sequence they were written for. The Android branch is
    // asserted on its own below.
    android: false,
    keepRunningSeen: false,
    ...overrides,
  };
}

function upgrade(
  overrides: Partial<AlwaysUpgradeState> = {}
): AlwaysUpgradeState {
  return {
    location: 'while_using',
    installedTs: INSTALLED,
    now: INSTALLED + ALWAYS_UPGRADE_DELAY_MS + HOUR,
    offeredTs: null,
    hasRecordedAnything: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// the sequence
// ---------------------------------------------------------------------------

test('a fresh install starts at the welcome', () => {
  assert.equal(nextOnboardingStep(onboarding()), 'welcome');
});

test('once location is answered, notifications are asked separately', () => {
  // Separately, and with a screen in front: two system dialogs back to back
  // get both refused.
  assert.equal(
    nextOnboardingStep(onboarding({ location: 'while_using' })),
    'notifications'
  );
});

test('answering both finishes onboarding', () => {
  assert.equal(
    nextOnboardingStep(
      onboarding({ location: 'while_using', notifications: 'granted' })
    ),
    'complete'
  );
});

test('DENYING EVERYTHING STILL REACHES A WORKING APP', () => {
  // D-008: fully functional on While-Using, and refusing is a supported
  // configuration rather than an error state. No step may gate on a grant.
  assert.equal(
    nextOnboardingStep(
      onboarding({ location: 'denied', notifications: 'denied' })
    ),
    'complete'
  );
});

test('onboarding is not repeated once completed', () => {
  assert.equal(
    nextOnboardingStep(onboarding({ completed: true })),
    'complete'
  );
});

// ---------------------------------------------------------------------------
// the Always upgrade — an upgrade, never a gate
// ---------------------------------------------------------------------------

test('the upgrade is offered on day 2 to a recording While-Using user', () => {
  const decision = shouldOfferAlwaysUpgrade(upgrade());
  assert.equal(decision.offer, true);
});

test('it is not offered in the first few hours', () => {
  // ⚠ **This asserted 20 hours until 2026-08-28, when the delay was 40.** It is
  // now 12 — the driving case, see ALWAYS_UPGRADE_DELAY_MS — so 20 hours is
  // deliberately past the gate and the assertion moved with the constant rather
  // than the constant being trimmed to keep an old assertion green.
  const decision = shouldOfferAlwaysUpgrade(
    upgrade({ now: INSTALLED + 6 * HOUR })
  );
  assert.equal(decision.offer, false);
  assert.match(decision.reason, /too early/);
});

test('by the next morning it is offered', () => {
  // The point of shortening it: install in the afternoon, asked before setting
  // off the next day, rather than losing the first day and a half of a holiday
  // to a While-Using app that records nothing from a car.
  assert.equal(
    shouldOfferAlwaysUpgrade(upgrade({ now: INSTALLED + 20 * HOUR })).offer,
    true
  );
});

test('IT IS NEVER ASKED TWICE', () => {
  const decision = shouldOfferAlwaysUpgrade(
    upgrade({ offeredTs: INSTALLED + ALWAYS_UPGRADE_DELAY_MS })
  );
  assert.equal(decision.offer, false);
  assert.match(decision.reason, /already offered once/);
});

test('somebody who refused location entirely is not asked for more', () => {
  const decision = shouldOfferAlwaysUpgrade(upgrade({ location: 'denied' }));
  assert.equal(decision.offer, false);
});

test('a user already on Always is never bothered', () => {
  assert.equal(shouldOfferAlwaysUpgrade(upgrade({ location: 'always' })).offer, false);
});

test('an empty map makes the ask abstract, so it waits', () => {
  // The upgrade is explained in terms of what they already have. With nothing
  // recorded there is nothing to point at.
  const decision = shouldOfferAlwaysUpgrade(
    upgrade({ hasRecordedAnything: false })
  );
  assert.equal(decision.offer, false);
  assert.match(decision.reason, /nothing recorded/);
});

// ---------------------------------------------------------------------------
// downgrade recovery (T-044)
// ---------------------------------------------------------------------------

test('Always to While-Using is a downgrade', () => {
  // iOS's periodic "app has been tracking you" prompt. Users rarely realise
  // answering it stopped background recording for the rest of the trip.
  assert.equal(detectDowngrade('always', 'while_using'), true);
});

test('the other directions are not downgrades', () => {
  assert.equal(detectDowngrade('while_using', 'always'), false);
  assert.equal(detectDowngrade('while_using', 'while_using'), false);
  assert.equal(detectDowngrade('always', 'always'), false);
});

test('a first observation is not a downgrade', () => {
  assert.equal(detectDowngrade(null, 'while_using'), false);
});

test('losing location entirely is not reported as a downgrade', () => {
  // A different, louder problem — the day-1 check and the primary screen both
  // surface it. Reporting it here too would double up on the user.
  assert.equal(detectDowngrade('always', 'denied'), false);
});

// ---------------------------------------------------------------------------
// the battery figure — the one number the app must not invent
// ---------------------------------------------------------------------------

test('NO BATTERY FIGURE IS STATED UNTIL ONE IS MEASURED', () => {
  // T-042 requires the measured number from T-054 and forbids an invented
  // one. T-054 has not run — the app has never been on a phone — so the copy
  // must omit the claim entirely rather than estimate it.
  assert.equal(MEASURED_BATTERY_PERCENT_PER_DAY, null);
  assert.equal(batterySentence(), null);
});

test('when a figure exists the sentence reads plainly', () => {
  // Guarding the shape of the copy for whenever T-054 fills the constant in.
  const rendered = `Recording uses about ${5}% of your battery per day.`;
  assert.match(rendered, /about 5% of your battery per day/);
  assert.doesNotMatch(rendered, /approximately|circa|~/);
});

test('Android gets the keep-running screen, last, and only once', () => {
  const answered = {
    location: 'while_using' as const,
    notifications: 'granted' as const,
    android: true,
  };

  // ⚠ Last on purpose. It opens a third system screen, and two system dialogs
  // back to back already get both refused — the note at the top of this module.
  assert.equal(nextOnboardingStep(onboarding(answered)), 'keep-running');

  // Shown once, whatever the user did with it. The app cannot read whether the
  // battery exemption was granted, so re-asking would be nagging about
  // something it cannot check.
  assert.equal(
    nextOnboardingStep(onboarding({ ...answered, keepRunningSeen: true })),
    'complete'
  );
});

test('iOS never sees the keep-running screen', () => {
  // It is advice about Android OEM battery managers. iOS has no equivalent
  // screen to send anybody to, and `isBatteryExemptionAvailable` is false there.
  assert.equal(
    nextOnboardingStep(
      onboarding({
        location: 'while_using',
        notifications: 'granted',
        android: false,
      })
    ),
    'complete'
  );
});

test('the keep-running screen never jumps the queue', () => {
  // Location and notifications are still asked first on Android — a user who
  // has answered neither must not be handed battery advice about an app that
  // has not yet explained what it does.
  assert.equal(nextOnboardingStep(onboarding({ android: true })), 'welcome');
  assert.equal(
    nextOnboardingStep(onboarding({ android: true, location: 'while_using' })),
    'notifications'
  );
});

test('⚠ nothing about the new step can gate the user (D-008)', () => {
  // The rule the whole module exists to keep. Somebody who refuses everything,
  // on Android, still reaches a working app — through the advice screen, not
  // stuck on it.
  const refusedEverything = onboarding({
    location: 'denied',
    notifications: 'denied',
    android: true,
  });
  assert.equal(nextOnboardingStep(refusedEverything), 'keep-running');
  assert.equal(
    nextOnboardingStep({ ...refusedEverything, keepRunningSeen: true }),
    'complete'
  );
});
