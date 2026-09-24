/**
 * The message shown after an app update, while the recorder cannot restart
 * itself (T-210). The pure half: what the native side is handed.
 *
 * MEASURED ON THE P30, 2026-09-24
 * -------------------------------
 * An update kills the app. With EMUI's launch management off, Android then
 * wakes it for `MY_PACKAGE_REPLACED`, but starting the recorder's foreground
 * service from the background is refused (T-173), so the recorder stays off
 * until the app is opened. Opening it restores the recorder at once.
 *
 * So one notification asks for that one tap. It is posted by native code,
 * `UpdateNoticeReceiver` (plugins/withUpdateNotice.js), because after an update
 * the app's JavaScript does not reliably run at all. The receiver cannot read
 * the database, so the app leaves it this file: whether automatic recording is
 * on (no message when the user turned it off themselves) and the text in the
 * user's own language.
 */

import { APP_NAME } from '../brand.ts';
import type { Language } from '../i18n/languages.ts';
import { STRINGS } from '../i18n/strings.ts';
import { translate } from '../i18n/translate.ts';
import { TRIP_CHANNEL_ID } from './tripChannel.ts';

/**
 * The notification's Android id. The native receiver posts with this number
 * (plugins/withUpdateNotice.js; `updateNotice.test.ts` checks they agree), and
 * the app clears it by it once the user is back in the app.
 */
export const UPDATE_NOTICE_ID = 7210;

/** How expo-notifications names a notification it did not post itself. */
export const UPDATE_NOTICE_IDENTIFIER = `expo-notifications://foreign_notifications?id=${UPDATE_NOTICE_ID}`;

/** In the app's files directory, where the receiver reads it. */
export const UPDATE_NOTICE_FILE = 'update-notice.json';

/** The same channel as the trip's other messages, from its one home. */
export const UPDATE_NOTICE_CHANNEL = TRIP_CHANNEL_ID;

export type UpdateNotice = {
  autoRecording: boolean;
  channelId: string;
  channelName: string;
  title: string;
  body: string;
};

export function buildUpdateNotice(autoRecording: boolean, language: Language): UpdateNotice {
  const vars = { app: APP_NAME };
  return {
    autoRecording,
    channelId: UPDATE_NOTICE_CHANNEL,
    channelName: translate(STRINGS['notify.channel.trip'], language, vars),
    title: translate(STRINGS['notify.updated.title'], language, vars),
    body: translate(STRINGS['notify.updated.body'], language, vars),
  };
}
