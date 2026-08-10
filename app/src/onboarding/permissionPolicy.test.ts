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

test('it is not offered on day one', () => {
  // Two prompts in one morning — the day-1 health check is at 14h — is how
  // you lose both.
  const decision = shouldOfferAlwaysUpgrade(
    upgrade({ now: INSTALLED + 20 * HOUR })
  );
  assert.equal(decision.offer, false);
  assert.match(decision.reason, /too early/);
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
