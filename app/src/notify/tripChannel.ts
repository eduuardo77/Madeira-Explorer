/**
 * The Android channel for the trip's messages. Its own pure module, so the
 * native update notice (updateNotice.ts) and sendTripNotification.ts, which
 * imports Expo, post to the one channel and cannot drift apart.
 */
export const TRIP_CHANNEL_ID = 'trip-messages';

/** D-096: the quiet channel for new stamps. Stable, for the same reason. */
export const STAMP_CHANNEL_ID = 'stamp-messages';
