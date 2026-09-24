/**
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_NAME } from '../brand.ts';
import { buildUpdateNotice } from './updateNotice.ts';

test('T-210: the notice is in the user\'s language, names the app, and says whether to fire', () => {
  const pt = buildUpdateNotice(true, 'pt');
  assert.equal(pt.autoRecording, true);
  assert.equal(pt.title, `Abra o ${APP_NAME} para continuar a registar`);
  assert.ok(pt.body.startsWith(`O ${APP_NAME} foi atualizado.`));
  assert.equal(buildUpdateNotice(false, 'de').autoRecording, false);
  assert.ok(buildUpdateNotice(true, 'de').title.includes(APP_NAME));
});

test('T-210: the native receiver that posts it is part of the build', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const plugins = (JSON.parse(readFileSync(path.join(appRoot, 'app.json'), 'utf8')) as {
    expo: { plugins: unknown[] };
  }).expo.plugins;
  assert.ok(plugins.includes('./plugins/withUpdateNotice'));
});
