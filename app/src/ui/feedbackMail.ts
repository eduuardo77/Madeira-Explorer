/**
 * The feedback email's address line (option A, 2026-10-07): the user writes,
 * and the subject already says which build they are on, so a report can be
 * matched to its version without asking. Nothing is attached and nothing is
 * sent without the user pressing send in their own email app.
 *
 * Pure. Tested in `feedbackMail.test.ts`.
 */
export function feedbackMailto(email: string, appName: string, version: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(`${appName} ${version}`)}`;
}
