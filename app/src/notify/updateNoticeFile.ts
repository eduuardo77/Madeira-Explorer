/**
 * Leave the native update receiver its notice (T-210). The impure half of
 * `updateNotice.ts`.
 *
 * Rewritten whenever what it says could change: at launch, when automatic
 * recording is switched, when the language is chosen, and when a trip is ended
 * by hand. Never throws: a stale file only means one message fewer or in the
 * old language, and nothing on these paths may fail because of it.
 */

import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { deviceLanguage } from '../i18n';
import { isBackgroundTrackingAllowed } from '../recording/trackingSettings';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import { buildUpdateNotice, UPDATE_NOTICE_FILE } from './updateNotice';

export async function writeUpdateNotice(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    const notice = buildUpdateNotice(await isBackgroundTrackingAllowed(), deviceLanguage());
    const file = new File(Paths.document, UPDATE_NOTICE_FILE);
    file.write(JSON.stringify(notice));
  } catch (error) {
    await recordingEventDao.logError('update notice', error);
  }
}
