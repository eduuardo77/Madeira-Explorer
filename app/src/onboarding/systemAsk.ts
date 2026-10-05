/**
 * What Android is about to show, and which answer to pick (T-250).
 *
 * The project lead's complaint about first run (2026-10-05): the system
 * dialogs arrived unannounced and were "confusing". WalkNYC's answer, which the
 * lead chose, is to draw the dialog on the card before it appears, with the
 * right button marked. That only helps if the replica says what the phone
 * says, so every label here is Android's own, read off real phones
 * (`strings.ts`, the `os.*` keys), and chosen by Android version, because the
 * dialogs changed between 10 and 11 and again at 12.
 *
 * Pure: the API level and the language come in, like `nowMs` elsewhere.
 */

import type { Language } from '../i18n/languages.ts';
import { STRINGS } from '../i18n/strings.ts';
import { translate } from '../i18n/translate.ts';
import type { FirstRunAsk } from './permissionPolicy.ts';

export type SystemAsk = {
  /**
   * A permission dialog (buttons stacked), a plain dialog (two buttons side by
   * side, the refusal on the left, as Settings' battery dialog draws them), or
   * a settings page the app is left for.
   */
  kind: 'dialog' | 'buttons' | 'settings';
  /** The labels, top to bottom, as Android lays them out. */
  options: string[];
  /** Which one to choose. */
  pick: number;
};

type Key = keyof typeof STRINGS;

/** Android 11: the first with "Only this time", and Always moved to settings. */
const API_R = 30;
/** Android 12: "Deny" became "Don't allow". */
const API_S = 31;

function labels(keys: Key[], language: Language): string[] {
  return keys.map((key) => translate(STRINGS[key], language));
}

/**
 * The replica for one ask, or null where there is nothing to draw: not
 * Android, or an ask with no system screen behind it.
 */
export function systemAskFor(
  ask: FirstRunAsk | 'always-upgrade' | 'downgrade',
  input: { android: boolean; apiLevel: number; language: Language }
): SystemAsk | null {
  if (!input.android) return null;
  const { apiLevel, language } = input;
  const dialog = (keys: Key[]): SystemAsk => ({ kind: 'dialog', options: labels(keys, language), pick: 0 });

  switch (ask) {
    case 'location':
      return apiLevel < API_R
        ? dialog(['os.q.whileUsing', 'os.deny'])
        : dialog(['os.whileUsing', 'os.onlyThisTime', 'os.dontAllow']);
    case 'always':
    case 'always-upgrade':
    case 'downgrade':
      // Android 10 asks in a dialog; 11 and later only on the app's location page.
      return apiLevel < API_R
        ? dialog(['os.allowAlways', 'os.q.keepWhileUsing', 'os.q.keepDontAsk'])
        : {
            kind: 'settings',
            options: labels(
              ['os.allowAlways', 'os.settings.whileUsing', 'os.settings.askEveryTime', 'os.dontAllow'],
              language
            ),
            pick: 0,
          };
    case 'activity':
      return dialog(['os.allow', apiLevel < API_S ? 'os.deny' : 'os.dontAllow']);
    case 'notifications':
      // Android 13 and later only; nothing older asks.
      return dialog(['os.allow', 'os.dontAllow']);
    case 'keep-running':
      // Settings' own dialog, the same two words on 10 and 14, side by side
      // with the refusal first (seen on the P30, 2026-10-05).
      return { kind: 'buttons', options: labels(['os.deny', 'os.allow'], language), pick: 1 };
  }
}

/** Android 11 and later answer "all the time" on a settings page, not in a dialog. */
export function alwaysOpensSettings(input: { android: boolean; apiLevel: number }): boolean {
  return input.android && input.apiLevel >= API_R;
}
