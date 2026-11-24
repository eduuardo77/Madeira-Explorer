/**
 * Turning a trip into a picture somebody can send (T-105d, T-107, T-108).
 *
 * Once a view has drawn a picture, captures it as a PNG and opens the share
 * sheet (the trophy card's share, T-327: the passport's went 24 Nov 2026).
 *
 * ⚠ **THE TRACE COMES THROUGH `exportTrace.ts` AND NOWHERE ELSE.** That module
 * is the single door D-016 and D-040 require every export to pass through, and
 * its own header says why: masking must not be a step somebody remembers to
 * apply. Reading `rawFixDao` here would publish where the user sleeps, and
 * there is no second safety net. If `safeToShare` is false, this refuses.
 *
 * ⚠ **Two new dependencies, both audited (D-043).** `react-native-view-shot`
 * photographs a view; `expo-sharing` opens the OS share sheet. Neither has a
 * network path — see `docs/dependency-audit.md`. The captured file is written
 * to the app's own cache directory and handed to the OS; nothing is uploaded,
 * which keeps D-001 true.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import * as recordingEventDao from '../storage/dao/recordingEventDao';
import { t } from '../i18n';
import type { ExportRefusal } from './exportTrace';
import { shareImageFilename } from './shareCard';

/**
 * Why a share did not happen, for the screen to translate (T-190).
 * `unavailable` is a phone with no share sheet.
 */
export type ShareRefusal = ExportRefusal | 'unavailable';

/** `share.refusal.*`, one per code. The screens say this; the diary says `reason`. */
export const REFUSAL_KEYS = {
  nothing: 'share.refusal.nothing',
  withheld: 'share.refusal.withheld',
  hidden: 'share.refusal.hidden',
  unavailable: 'share.refusal.unavailable',
  failed: 'share.refusal.failed',
} as const satisfies Record<ShareRefusal, string>;

export type ShareSendResult =
  | { ok: true }
  | { ok: false; refusal: ShareRefusal; reason: string };

/**
 * Give the capture a name a person would choose (T-192).
 *
 * view-shot writes `ReactNative-snapshot-image<digits>.png`, and its own
 * `fileName` option still appends digits (`File.createTempFile`), so the file
 * is moved instead. ⚠ **A failed rename must not cost the share**: the
 * worst case is the old name, logged.
 */
async function nameTheImage(capturedUri: string): Promise<string> {
  try {
    const named = new File(Paths.cache, shareImageFilename(Date.now()));
    await new File(capturedUri).move(named, { overwrite: true });
    return named.uri;
  } catch (error) {
    await recordingEventDao.logError('share image name', error);
    return capturedUri;
  }
}

/**
 * Photograph the drawn card and hand it to the OS share sheet.
 *
 * `viewRef` must point at a mounted `ShareCardView`. The capture is a file in
 * the app's cache directory; the OS copies what it needs and the file is
 * disposable — nothing is uploaded by this app, and neither library has a
 * network path (D-001, D-043).
 */
export async function shareCardImage(
  viewRef: React.RefObject<View | null>
): Promise<ShareSendResult> {
  try {
    if (viewRef.current === null) {
      return { ok: false, refusal: 'failed', reason: 'the card is not on screen yet' };
    }

    const captured = await captureRef(viewRef, { format: 'png', quality: 1, result: 'tmpfile' });
    const uri = await nameTheImage(captured);

    if (!(await Sharing.isAvailableAsync())) {
      // A device with no share sheet at all. Rare, and not worth a crash.
      return { ok: false, refusal: 'unavailable', reason: 'this device cannot share files' };
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: t('passport.share.dialogTitle'),
      UTI: 'public.png',
    });
    return { ok: true };
  } catch (error) {
    await recordingEventDao.logError('share card image', error);
    return { ok: false, refusal: 'failed', reason: 'the image could not be shared' };
  }
}
