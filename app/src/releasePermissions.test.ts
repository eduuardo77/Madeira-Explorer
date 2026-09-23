/**
 * The release build strips what it never uses, and never what it needs (T-194).
 *
 *     cd app && npm test
 *
 * `plugins/withoutUnusedPermissions.js` removes permissions from the release
 * manifest. Removing too few is a privacy promise broken in the list users
 * read; removing one too many is a recorder that silently cannot record, which
 * no unit test anywhere else would notice (the T-145 shape). So both directions
 * are pinned here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plugin = require('../plugins/withoutUnusedPermissions.js') as { REMOVE: string[] };

/** What the product is built on. Stripping any of these breaks it. */
const NEEDED = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
  // The Google basemap loads over the network (D-057).
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
];

test('⚠ T-194 — nothing the recorder, the map or a notification needs is stripped', () => {
  assert.deepEqual(
    NEEDED.filter((name) => plugin.REMOVE.includes(name)),
    []
  );
});

test('⚠ T-194 — push, the install referrer and the launcher badges are stripped', () => {
  // Read off the P30's `dumpsys package` by the review of 2026-09-22.
  for (const name of [
    'com.google.android.c2dm.permission.RECEIVE',
    'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE',
    'com.huawei.android.launcher.permission.CHANGE_BADGE',
    'com.sec.android.provider.badge.permission.READ',
    'android.permission.READ_APP_BADGE',
  ]) {
    assert.ok(plugin.REMOVE.includes(name), name);
  }
});

test('T-117a — the dev client\'s overlay permission is still stripped', () => {
  assert.ok(plugin.REMOVE.includes('android.permission.SYSTEM_ALERT_WINDOW'));
});
