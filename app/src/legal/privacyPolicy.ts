/**
 * The privacy policy (T-124).
 *
 * WHY THE TEXT LIVES IN CODE AND THE MARKDOWN IS GENERATED
 * -------------------------------------------------------
 * Two copies of a privacy policy are needed and they must not drift: one
 * inside the app, because D-001 forbids the network and a policy the user
 * cannot read offline is a policy they cannot read; and one at a public URL,
 * because both stores demand one in the listing.
 *
 * So this module is the single source and `tools/generate-privacy-policy.mjs`
 * emits `docs/privacy-policy.md` from it — the same rule the map styles follow
 * (`tiles/style/generate.mjs`): **never edit the generated file.** A policy
 * that says one thing in the app and another on the web is worse than either.
 *
 * WHAT MADE THIS SHORT
 * --------------------
 * There is genuinely almost nothing to disclose (D-001): no account, no
 * server, no analytics, no ads. T-117's audit confirmed it rather than assumed
 * it — `docs/dependency-audit.md`. The work here was not finding things to
 * say; it was finding the **two honest exceptions** a careless policy would
 * omit, because "nothing ever leaves your phone" is very nearly true and the
 * gap between "very nearly" and "true" is where a policy earns its keep:
 *
 *   1. **The device's own backup.** ARCHITECTURE §4a deliberately includes the
 *      database in normal encrypted device backup — it is the answer to "my
 *      phone died on day 5". That means a copy of the trip goes to iCloud or
 *      Google, under the user's own account and encryption, outside this app's
 *      reach. It is the right trade and it must be stated, not buried.
 *   2. **Anything the user shares.** The souvenir is an export of location
 *      history (D-016). Sharing it publishes where they went, to whoever sees
 *      it. Their accommodation is removed first, by default and with no way to
 *      turn it off (D-040), but the rest is theirs to publish knowingly.
 *   3. **The map itself** (D-057, 2026-08-14). ⚠ **This is the big one, and it
 *      is new.** The app used to ship its own map and make no network requests
 *      at all. It now draws the platform's map — Google's on Android — which
 *      streams tiles as the user pans and zooms. Google therefore sees requests
 *      from the phone that amount to *which part of the island is on screen*.
 *
 *      What has **not** changed, and the policy has to be exact about the
 *      difference: there is still no account, no server of ours, no analytics,
 *      and **the recorded trip is never sent anywhere**. The map is a picture
 *      the phone fetches to draw under the trip; the trip stays put.
 *
 *      The Directions button that briefly existed here (D-018) is gone (D-055),
 *      so there is no longer a handoff to disclose.
 *
 * ON NOT LISTING LIBRARIES
 * ------------------------
 * The audit found that `expo-notifications` puts Firebase Cloud Messaging in
 * the Android build (D-043). It is never given anything to send and there is no
 * server to send it to, so there is no data practice to disclose and it is not
 * mentioned here — a lay reader asked to reason about a push library they were
 * never subject to is a reader who trusts the document less, not more. The
 * technical account belongs in `docs/dependency-audit.md`, which is what a
 * reviewer gets. If that ever stops being true, this decision reverses.
 *
 * ⚠ **NOT LEGAL ADVICE AND NOT LAWYER-REVIEWED.** This is a plain-English
 * account of what the app actually does, written from the audit. It should be
 * read by somebody qualified before either store submission (T-123).
 *
 * Pure: no Expo, no database, no clock. Tested in `privacyPolicy.test.ts`.
 */

/**
 * The date this text last changed, in ISO form. Shown to the user, and the
 * thing a returning reader checks first.
 */
export const POLICY_VERSION = '2026-08-22';

/**
 * The app's name as it appears to the user.
 *
 * ⚠ A WORKING TITLE. `docs/design-brief.md` §7 has not been through INPI or
 * EUIPO, and the cautionary case there is a real app under a cease and desist
 * for naming itself after a city's own wayfinding programme. Changing it is a
 * one-line edit here plus `app.json`.
 */
import { APP_NAME } from '../brand.ts';
import type { Language } from '../i18n/languages.ts';
import { CONTACT_SECTION_PT, SECTIONS_PT } from './privacyPolicy.pt.ts';

/**
 * Where a user can write to about their data.
 *
 * **Null on purpose, and a test keeps it that way** — the same stance D-041
 * takes on the unmeasured battery figure. Both stores require a contact before
 * submission, so this must be filled in for T-123; until it is, the section is
 * **omitted entirely** rather than shipped with a placeholder address. A
 * policy inviting people to write to `example@example.com` is worse than one
 * that does not invite them to write at all.
 *
 * It is deliberately not defaulted to the project lead's personal address:
 * publishing somebody's email in a store listing is their decision to make.
 */
export const CONTACT_EMAIL: string | null = null;

export type PolicySection = {
  heading: string;
  paragraphs: string[];
};

/**
 * The policy.
 *
 * Plain English, short sentences, no jargon — D-015 and CONTEXT §6.5 apply to
 * this as much as to any other screen, and a policy an 80-year-old will not
 * read is decoration. `privacyPolicy.test.ts` enforces the vocabulary rather
 * than trusting anyone's eye, the same way T-114 did for onboarding.
 */
const SECTIONS_EN: PolicySection[] = [
  {
    heading: 'The short version',
    paragraphs: [
      `${APP_NAME} records where you go while you are on holiday, and shows it back to you as a map. All of that stays on your phone.`,
      'There is no account, no sign-up and no server of ours behind this app. We have no way to see where you have been, because your trip is never sent to us. We do not know who you are and we cannot find out.',
      'The map you see underneath your trip comes from Google, the same as in most map apps. Google sees which part of the island you are looking at. It does not see your trip, because your trip never leaves the phone.',
      'Nobody is paying us for your data. There are no adverts and nothing is measuring how you use the app.',
    ],
  },
  {
    heading: 'What the app records',
    paragraphs: [
      'Where your phone was, and when. This is the map of your trip.',
      'Your step count and the air pressure around you, on phones that can measure them. These help work out where you walked when the satellite signal is blocked, in a tunnel or under trees.',
      'Which of the places in the app you have reached, and when you collected each stamp.',
      'A short diary of whether recording was working, so the app can tell you if it stopped.',
    ],
  },
  {
    heading: 'Where all of that is kept',
    paragraphs: [
      'On your phone, in storage that only this app can read.',
      'Your trip is included in the ordinary backup your phone already makes to iCloud or to Google, if you have backups switched on. That is what protects your holiday if your phone is lost or broken halfway through it. That backup is yours, under your own account and your own encryption — we cannot reach it, and neither can anyone else without your account.',
      'You can turn that off in your phone settings, in the same place you control backups for everything else.',
      'The map of the island itself is left out of the backup. It is large, it is the same for everybody, and the app can simply build it again.',
    ],
  },
  {
    heading: 'When you share your trip',
    paragraphs: [
      'At the end of your holiday the app can make a short video or a picture of your map, for you to share if you want to.',
      'Sharing it is the one time your trip leaves your phone, and it goes wherever you send it — not to us. Anyone who sees it can see roughly where you went.',
      'Before making it, the app finds where you slept and removes that part of your map. It does this every time, and there is no setting to switch it off. If it cannot work out where you were staying, it will not make the video at all rather than risk showing your address.',
      'Everything else on the map is yours to share or not.',
    ],
  },
  {
    heading: 'The map itself',
    paragraphs: [
      'The map you see is Google\u2019s, the same map used by most apps on an Android phone. It is downloaded a piece at a time as you move around it, so Google can see which part of the island is on your screen.',
      'Google does not see your trip. The line showing where you have been is drawn by this app, on top of their map, from the record kept on your phone. That record is never sent to them or to us.',
      'This does mean the map needs an internet connection. Recording carries on regardless \u2014 your trip is still being saved with no signal at all, and it will appear on the map once you have one.',
      'Google has its own privacy policy, which covers what they do with those map requests.',
    ],
  },
  {
    heading: 'When the app updates itself',
    paragraphs: [
      'When you open the app it asks whether there is a newer version of it, and downloads one if there is. This is how a fix reaches you without you having to install anything.',
      'That question goes to Expo, the company whose tools this app is built with. They see that a phone asked, and which version it already has. They do not see your trip, your stamps or your name, because none of that is sent.',
      'It is one short request when the app opens, and nothing else. If you have no signal it fails quietly and the app carries on with the version it already has.',
      'Expo has its own privacy policy, which covers what they do with those requests.',
    ],
  },
  {
    heading: 'What the app asks permission for',
    paragraphs: [
      'Your location. This is the whole app; without it there is no map. You can allow it only while the app is open, and it will still work — you start and stop recording yourself.',
      'Your location while the app is closed. This is what lets you forget about the app for a week and still get your map. You can say no, and the app keeps working.',
      'Motion and fitness, or physical activity. This is the step counter and the air pressure sensor described above.',
      'Notifications. The app sends two, ever: one on your first day to tell you whether recording is working, and one at the end to say your map is ready.',
      'You can change any of these later in your phone settings, and the app will carry on with whatever you allow.',
    ],
  },
  {
    heading: 'Deleting your trip',
    paragraphs: [
      'Settings has a button that erases everything the app has recorded. It takes effect immediately and completely.',
      'There is no account and no server, so there is nothing for us to delete at our end and nothing to ask us for. Deleting from your phone is the whole of it.',
      'Because there is no copy anywhere else, erasing cannot be undone. If your phone backup still holds an older copy, that is yours to remove in your phone settings.',
      'Removing the app deletes everything too.',
    ],
  },
  {
    heading: 'Children',
    paragraphs: [
      'This app is not aimed at children and we do not knowingly collect anything from them. As with everyone else, nothing is collected by us at all — it stays on the phone.',
    ],
  },
  {
    heading: 'If this policy changes',
    paragraphs: [
      'Any change will appear here and the date at the top will change with it. This page is stored inside the app, so you can always read the version you actually have, even with no signal.',
    ],
  },
];

/**
 * The policy as it should be shown or published.
 *
 * The contact section is appended only when there is an address to give, which
 * is why this is a function rather than a constant.
 */
/**
 * A line shown to readers whose language the policy does not exist in.
 *
 * ⚠ **Shown rather than hidden, on purpose (T-160b).** The alternative is
 * silently rendering English to somebody who set their phone to German, which
 * looks like the app failed to translate rather than like a decision. Saying
 * which languages it exists in is the honest version, and it is one sentence.
 *
 * The policy is Portuguese and English only because it is the one document where
 * a rough translation is a **compliance** problem rather than a rough edge: it is
 * already marked as needing a qualified reader before store submission (T-123),
 * and nobody on this project speaks German (T-160a).
 */
const LANGUAGE_NOTE: Record<Language, string | null> = {
  en: null,
  pt: null,
  de: 'Diese Datenschutzerklärung liegt auf Englisch und Portugiesisch vor. Sie lesen die englische Fassung.',
};

/**
 * The policy as it should be shown or published.
 *
 * The contact section is appended only when there is an address to give, which
 * is why this is a function rather than a constant.
 *
 * ⚠ **`language` defaults to English** so every existing caller — the generator
 * in `tools/`, the tests, anything published — keeps meaning exactly what it did
 * before this became translatable.
 */
export function policySections(language: Language = 'en'): PolicySection[] {
  const translated = language === 'pt';
  const base = translated ? SECTIONS_PT : SECTIONS_EN;

  const note = LANGUAGE_NOTE[language];
  const sections: PolicySection[] =
    note === null
      ? [...base]
      : [{ heading: 'Sprache', paragraphs: [note] }, ...base];

  if (CONTACT_EMAIL === null) {
    return sections;
  }

  return [
    ...sections,
    translated
      ? CONTACT_SECTION_PT(CONTACT_EMAIL)
      : {
          heading: 'Getting in touch',
          paragraphs: [
            `If you have a question about any of this, write to ${CONTACT_EMAIL}.`,
            'We will not be able to look anything up about your trip, because we do not have it.',
          ],
        },
  ];
}

/** Every word of the policy, for checks that care about the whole text. */
export function policyText(language: Language = 'en'): string {
  return policySections(language)
    .map((section) => [section.heading, ...section.paragraphs].join('\n'))
    .join('\n\n');
}
