/**
 * "Did you walk it?" — the question D-065 leaves the app holding (T-149).
 *
 * WHY THE APP ASKS AT ALL
 * -----------------------
 * Coverage crediting decides most levada walks on its own: 60% of the course,
 * or 3 km of it, and the stamp lands with nobody consulted. Between that and
 * *never went* there is a real band — a walk that shows 1.6 km of a 5 km levada
 * because the canopy ate half the fixes, or because the walker did the pretty
 * middle section and drove back. **The evidence is real and it is not enough.**
 *
 * Refusing silently is the frustration the project lead named, and awarding
 * silently would make a stamp mean "the app was fairly sure". So the app says
 * what it saw and lets the person who was there settle it.
 *
 * THE RULES OF ASKING, WHICH ARE THE WHOLE DESIGN
 * -----------------------------------------------
 * 1. **A confirmation, never a claim.** There is no "mark as collected" button
 *    anywhere in this app. The question is only ever raised by evidence the
 *    recorder gathered, so the user cannot invent a stamp for a place they
 *    never went (D-002 — the stamps are the score, and a score you can type in
 *    is not one).
 * 2. **Ask once.** A declined question is remembered. Being asked twice about a
 *    walk you did not do is the app calling you a liar, politely, forever.
 * 3. **Show the evidence in the question.** *"The trace shows 2.1 km along it"*
 *    — so the answer is a memory check, not a guess about what the app wants.
 * 4. **Never more than one at a time.** Three questions stacked on the passport
 *    is a form, and this screen is a reward (design brief §4, T-112).
 *
 * Pure: no database, no clock, no Expo. Tested in `stampConfirmation.test.ts`.
 */

/** What the award pass found, plus what the app already knows about it. */
export type ConfirmationCandidate = {
  placeId: string;
  /** Display name — the question names the place, not its id. */
  name: string;
  /** The verdict's own words: `"walked 2.1 km of 5.0 km (42%)"`. */
  evidence: string;
};

export type ConfirmationPrompt = {
  placeId: string;
  /** *"Did you walk the Levada do Furado?"* */
  question: string;
  /** *"The trace shows 2.1 km of 5.0 km (42%) — not enough for the app to be sure."* */
  detail: string;
  /** The label on the affirmative control. Deliberately not "Yes". */
  confirmLabel: string;
  declineLabel: string;
};

/**
 * The one question worth asking now, or null.
 *
 * `declined` is the set of place ids the user has already said no to. Awarded
 * places never reach here — the award pass filters them before it judges — but
 * they are accepted as a second guard, because a question about a stamp you
 * already hold is the most confusing one of all.
 */
export function nextPrompt(
  candidates: readonly ConfirmationCandidate[],
  declined: ReadonlySet<string>,
  awarded: ReadonlySet<string> = new Set()
): ConfirmationPrompt | null {
  const asking = candidates.find(
    (candidate) => !declined.has(candidate.placeId) && !awarded.has(candidate.placeId)
  );
  if (asking === undefined) {
    return null;
  }

  return {
    placeId: asking.placeId,
    // The place's own name, unadorned. "Did you walk the Levada do Furado?"
    // reads as a question about a walk; "Confirm visit to POI" reads as a form.
    question: `Did you walk the ${asking.name}?`,
    detail: `${capitalise(asking.evidence)} — enough to ask, not enough for the app to be sure.`,
    // ⚠ Not "Yes". The button says what it does, because a screen reader user
    // hears the buttons out of order and "Yes" alone means nothing (D-015).
    confirmLabel: 'I walked it',
    declineLabel: 'Not this time',
  };
}

function capitalise(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/**
 * The reason recorded on a stamp the user confirmed.
 *
 * ⚠ **It keeps the machine's own evidence in it.** A row reading only
 * "confirmed by the user" would be indistinguishable from a claim, and T-131
 * retunes the thresholds by reading exactly these rows: every confirmed walk is
 * a data point saying *the bar was too high here*.
 */
export function confirmationReason(evidence: string): string {
  return `confirmed by the user: ${evidence}`;
}

/**
 * Confidence for a confirmed stamp.
 *
 * ⚠ **Higher than the machine's, and deliberately not 1.0.** The person who was
 * there beats a partial trace, which is why it is worth asking at all. It stops
 * short of certainty because the app cannot tell a careful memory from a
 * generous one, and a stored 1.0 would later read as *measured*.
 */
export const CONFIRMED_CONFIDENCE = 0.9;
