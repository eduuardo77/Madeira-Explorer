/**
 * The notification budget (T-116, D-011).
 *
 * WHY A BUDGET AND NOT JUST TWO CAREFUL CALL SITES
 * ------------------------------------------------
 * D-011 caps this app at **two notifications per trip, ever** — the day-1
 * health check and the trip-end reveal — and CONTEXT §4.5 explains why the
 * number is two rather than zero: the enemy of a ghost app is the OS, not the
 * user, and a recorder that dies on day 2 and is discovered on day 7 is worse
 * than never having installed the app. Two messages in seven days is the
 * difference between a delightful surprise and a silent failure found too late.
 *
 * Both call sites already guard themselves, so nothing is broken today. What
 * is missing is anything that would **notice a third**. A future feature that
 * adds a nudge, a "you're near a levada" tap, or a re-permission prompt would
 * sail past two people's review, because the cap lives in a decision document
 * and not in the code. That is exactly how D-011 gets quietly repealed.
 *
 * The privacy policy now also *promises* it to the user in plain words
 * (D-044): "The app sends two, ever." A promise in shipped copy deserves an
 * enforcement stronger than everyone remembering.
 *
 * So there is **one door** — `notify/sendTripNotification.ts` — and this is the
 * arithmetic behind it. Same shape as `exportTrace` being the only way a trace
 * leaves the app (D-040): the rule is not a step somebody remembers, it is the
 * only path.
 *
 * WHY THE BUDGET IS PER TRIP AND NOT PER INSTALL
 * ----------------------------------------------
 * A returning visitor — and Madeira has an unusual number of them (CONTEXT
 * §4.10) — starts a new trip and should get their day-1 check and their reveal
 * again. Counting per install would silently mute the app on the second
 * holiday, which is the one the repeat visitor cares most about.
 *
 * Pure: no database, no Expo, no clock. Tested in `notificationPolicy.test.ts`.
 */

/**
 * The two notifications this app is allowed to send, and the only two.
 *
 * A new entry here is a change to D-011 and must be argued for in
 * `DECISIONS.md` — the type is the point, not a convenience.
 */
export const NOTIFICATION_KINDS = ['health_check', 'reveal'] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * The cap, from D-011.
 *
 * It equals the number of kinds on purpose: the budget can be spent in any
 * order, but it cannot be spent twice on the same thing and it cannot be
 * stretched by inventing a third kind.
 */
export const MAX_PER_TRIP = 2;

export type BudgetDecision = {
  allowed: boolean;
  /** Always populated. Goes to the recorder's diary, never to the user. */
  reason: string;
};

/**
 * May this notification be sent?
 *
 * `alreadySent` is the kinds already sent **for the current trip**. Refusing is
 * a normal outcome, not an error — the caller logs it and carries on, because
 * a missed reassurance is a small harm and a notification loop on a device
 * that keeps being killed mid-send would burn the whole budget in an afternoon.
 */
export function canNotify(
  kind: NotificationKind,
  alreadySent: readonly NotificationKind[]
): BudgetDecision {
  if (alreadySent.includes(kind)) {
    // The common case, and not a bug: both call sites can run more than once
    // per trip — the health check on every launch, trip end on every geofence
    // crossing — and rely on being told no.
    return { allowed: false, reason: `${kind} already sent for this trip` };
  }

  if (alreadySent.length >= MAX_PER_TRIP) {
    // Unreachable while there are exactly two kinds, and deliberately kept:
    // it is the assertion that catches a third kind being added without the
    // decision being revisited.
    return {
      allowed: false,
      reason: `budget spent: ${alreadySent.length} of ${MAX_PER_TRIP} used (D-011)`,
    };
  }

  return {
    allowed: true,
    reason: `${kind}: ${alreadySent.length + 1} of ${MAX_PER_TRIP} (D-011)`,
  };
}

/**
 * Parse the record of what has been sent.
 *
 * Anything unrecognised is dropped rather than trusted — the value comes back
 * from `app_state`, which is a text column somebody could have hand-edited
 * during a debug session. A bad row must cost at most one notification, never
 * a crash on the recorder's path (D-010).
 */
export function parseSent(raw: string | null): NotificationKind[] {
  if (raw === null || raw.trim() === '') {
    return [];
  }

  const kinds: NotificationKind[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (isKind(trimmed) && !kinds.includes(trimmed)) {
      kinds.push(trimmed);
    }
  }
  return kinds;
}

/** The record to store back. Stable order, so the value does not churn. */
export function serialiseSent(kinds: readonly NotificationKind[]): string {
  return NOTIFICATION_KINDS.filter((kind) => kinds.includes(kind)).join(',');
}

function isKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}
