/**
 * What the app is called, in one place (D-074).
 *
 * WHY THIS MODULE EXISTS, AND IT IS A REPAIR
 * ------------------------------------------
 * `privacyPolicy.ts` has exported `APP_NAME` since T-124 — and when the app was
 * renamed on 2026-08-17, **five files turned out to hardcode the old string
 * anyway**: the souvenir card, the settings footnote, the foreground-service
 * notification and two health-check notification bodies. A constant that most
 * callers ignore is not a constant, it is a suggestion.
 *
 * So the name lives here, above both `legal/` and `souvenir/`, because both need
 * it and neither should depend on the other. `brand.test.ts` fails the build if a
 * user-facing string hardcodes it again.
 *
 * RENAMED 2026-09-25: **BRUMA** (D-092, supersedes D-074)
 * ----------------------------------------------------------
 * **Bruma** is mist, in Portuguese and Spanish. The rules that chose it: it
 * sounds the same in Portuguese and English, and the name need not explain the
 * app because the store title's descriptor does. The **Play title is
 * "Bruma: Madeira Walk Tracker"**, set in Play Console, not here.
 *
 * ⚠ **The package stays `com.proa.madeira`**, by the project lead's choice: it
 * shows only in the Play web address, and changing it would have orphaned the
 * beta data on the phone and broken the Maps key restriction. For the same
 * reason the internal identifiers keep "proa": `EXPO_PUBLIC_PROA_BETA`, the
 * `PROA_UPLOAD_*` signing properties, `proaFieldBuild`, the Expo slug and scheme,
 * and the "Proa" logcat tag. No user reads them, and renaming them would break
 * local build setups that already use them.
 *
 * What follows is the 2026-08-17 reasoning, kept as history.
 *
 * NAMING, DECIDED 2026-08-17 (D-074, design brief §7)
 * ---------------------------------------------------
 * **Proa** — the prow of a ship. Short enough for the souvenir watermark, which
 * design brief §7.2 calls the primary distribution surface; spellable by a UK,
 * German or Nordic visitor who saw it once; not a place in `content/pois.json`,
 * which is what disqualified *Fanal*; and it carries no surveillance connotation,
 * which is what disqualified *Rasto* — a word that reads as **tracking** in
 * Portuguese, on an app that must pass a manual background-location review
 * (T-123).
 *
 * ⚠ **This is the name on the device, under the icon.** The **store listing
 * title is "Proa - Madeira"** and is set in Play Console, not here — Play indexes
 * that title, and *Madeira* is the word people actually search. Deliberately
 * different: a home screen truncates, a search result does not.
 */

/** The app's name, as a user sees it. */
export const APP_NAME = 'Bruma';
