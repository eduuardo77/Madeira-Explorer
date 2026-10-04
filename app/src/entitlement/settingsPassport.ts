/**
 * Which passport rows Settings shows (T-156e, D-089).
 *
 * - **Locked:** *Unlock the passport* (opens the unlock sheet) and *Recover
 *   purchase*, for a purchase made on another phone or before an erase-all.
 * - **Unlocked:** *Recover purchase* only. It stays because it costs nothing
 *   and it is the answer to "I paid and it shows locked" (OQ-7).
 * - **Beta build:** nothing. The beta is unlocked and sells nothing (D-084).
 *
 * Pure, so the rule is tested in Node; `SettingsView` draws what it returns.
 */

export type PassportRow = 'unlock' | 'recover';

export interface PassportSettings {
  rows: PassportRow[];
  footnote: 'locked' | 'unlocked';
}

export function passportSettings(input: { unlocked: boolean; beta: boolean }): PassportSettings | null {
  if (input.beta) return null;
  return input.unlocked
    ? { rows: ['recover'], footnote: 'unlocked' }
    : { rows: ['unlock', 'recover'], footnote: 'locked' };
}
