/**
 * Generate `docs/privacy-policy.md` from the policy the app actually shows
 * (T-124).
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/generate-privacy-policy.mjs
 *
 * (The flag only silences the same "not specified as a module" notice that
 * `npm test` suppresses; the script runs fine without it.)
 *
 * WHY THIS EXISTS
 * ---------------
 * Two copies of the policy are needed: one inside the app, because D-001
 * forbids the network and a policy the user cannot read offline is a policy
 * they cannot read; and one at a public URL, because both stores require one
 * in the listing before they will accept a background-location app (T-123).
 *
 * Two hand-maintained copies of a legal document is a promise to let them
 * drift, and a policy that says one thing in the app and another on the web is
 * worse than either. So `app/src/legal/privacyPolicy.ts` is the source and
 * this emits the other. **Never edit `docs/privacy-policy.md`** — the same
 * rule the map styles follow.
 *
 * It reads a TypeScript module directly, which works because Node 22+ strips
 * types as it loads a file — the same property that lets the unit tests run
 * with no framework (CONTEXT §6.6).
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  APP_NAME,
  CONTACT_EMAIL,
  POLICY_VERSION,
  policySections,
} from '../app/src/legal/privacyPolicy.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, '..', 'docs', 'privacy-policy.md');

const lines = [
  `# ${APP_NAME} — Privacy Policy`,
  '',
  `**Last changed:** ${POLICY_VERSION}`,
  '',
  '<!--',
  '  GENERATED FILE — DO NOT EDIT.',
  '  Source: app/src/legal/privacyPolicy.ts',
  '  Regenerate: node tools/generate-privacy-policy.mjs',
  '',
  '  This is the text published at the store-listing URL. The app shows the',
  '  same words offline from the same source, so the two cannot disagree.',
  '-->',
  '',
];

for (const section of policySections()) {
  lines.push(`## ${section.heading}`, '');
  for (const paragraph of section.paragraphs) {
    lines.push(paragraph, '');
  }
}

writeFileSync(target, lines.join('\n'), 'utf8');

const sections = policySections().length;
const words = policySections()
  .flatMap((section) => [section.heading, ...section.paragraphs])
  .join(' ')
  .split(/\s+/).length;

console.log(`docs/privacy-policy.md: ${sections} sections, ${words} words`);

if (CONTACT_EMAIL === null) {
  // Loud, because this is the one thing that blocks a store submission and it
  // is invisible in the output — the section is omitted rather than shown
  // empty, exactly so nobody ships a placeholder address.
  console.log('');
  console.log('⚠ CONTACT_EMAIL is null, so there is no contact section.');
  console.log('  Both stores require a contact before submission (T-123).');
}
