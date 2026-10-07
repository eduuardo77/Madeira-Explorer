import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feedbackMailto } from './feedbackMail.ts';

test('the feedback email names the build in its subject, encoded for a URL', () => {
  assert.equal(
    feedbackMailto('someone@example.com', 'Atlas', '1.0.0 (beta)'),
    'mailto:someone@example.com?subject=Atlas%201.0.0%20(beta)'
  );
});
