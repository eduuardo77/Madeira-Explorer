/**
 * Switching automatic recording on or off (T-146), from the Settings switch or
 * from the map's question (2026-10-18). One path, so the two cannot drift: the
 * stored choice, then the recorder, then the update notice.
 *
 * ⚠ Not just remembered for later: the recorder starts or stops here, because
 * a consent switch that takes effect on some later screen is not consent.
 */

import { writeUpdateNotice } from '../notify/updateNoticeFile';
import { setBackgroundTrackingAllowed } from './trackingSettings';
import { applyBackgroundTrackingChange } from './tripRecording';

export async function setAutomaticRecording(allowed: boolean): Promise<void> {
  await setBackgroundTrackingAllowed(allowed);
  await applyBackgroundTrackingChange(allowed);
  // T-210: no update message for someone who switched recording off.
  await writeUpdateNotice();
}
