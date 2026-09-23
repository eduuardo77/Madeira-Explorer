/**
 * The language the user chose in Settings, stored (T-202).
 *
 * The impure half of `languages.ts`' `parseLanguageChoice`. Loaded once before
 * the first screen (App.tsx) and once in each background task, because a
 * background task runs without App.tsx and would otherwise post its
 * notification in the phone's language rather than the one the user picked.
 */

import * as appStateDao from '../storage/dao/appStateDao';
import { setChosenLanguage } from './deviceLocale';
import { parseLanguageChoice, type Language } from './languages';

let loaded = false;

/** Read the stored choice and apply it. Once per process; never throws. */
export async function loadLanguageChoice(): Promise<void> {
  if (loaded) {
    return;
  }
  try {
    setChosenLanguage(parseLanguageChoice(await appStateDao.get(appStateDao.AppStateKey.Language)));
    loaded = true;
  } catch {
    // The phone's language, which is what an unreadable row should mean.
  }
}

/** Store and apply a choice. Null follows the phone. */
export async function saveLanguageChoice(language: Language | null): Promise<void> {
  setChosenLanguage(language);
  loaded = true;
  await appStateDao.set(appStateDao.AppStateKey.Language, language ?? '');
}
