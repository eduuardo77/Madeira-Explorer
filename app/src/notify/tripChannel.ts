/**
 * The Android channel for the trip's messages. Its own pure module, so the
 * native update notice (updateNotice.ts) and sendTripNotification.ts, which
 * imports Expo, post to the one channel and cannot drift apart.
 */
export const TRIP_CHANNEL_ID = 'trip-messages';
