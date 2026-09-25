/**
 * Tests for the smoke test's reader (T-222).
 *
 *     node --test tools/lib/uiTree.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { centre, crashLines, findNode, parseNodes } from './uiTree.mjs';

// The shape `uiautomator dump` writes, trimmed to three elements.
const DUMP = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">
<node index="0" text="" resource-id="" class="android.view.ViewGroup" package="com.proa.madeira" content-desc="Definições" checkable="false" checked="false" clickable="true" bounds="[24,96][204,276]" />
<node index="1" text="Português" resource-id="" class="android.widget.TextView" package="com.proa.madeira" content-desc="" checkable="false" checked="false" clickable="false" bounds="[48,900][500,960]" />
<node index="2" text="" resource-id="" class="android.view.ViewGroup" package="com.proa.madeira" content-desc="Ver a sua viagem" checkable="true" checked="true" clickable="true" bounds="[100,400][300,460]"><node index="0" text="Ver &quot;isto&quot; &amp; aquilo" package="com.proa.madeira" content-desc="" bounds="[0,0][1,1]" /></node>
</hierarchy>`;

test('nodes come out with their label, text, state and bounds', () => {
  const nodes = parseNodes(DUMP);
  assert.equal(nodes.length, 4);
  assert.deepEqual(nodes[0].bounds, [24, 96, 204, 276]);
  assert.equal(nodes[0].desc, 'Definições');
  assert.equal(nodes[2].checkable, true);
  assert.equal(nodes[2].checked, true);
  assert.equal(nodes[3].text, 'Ver "isto" & aquilo');
});

test('a control is found by its spoken label first, then by its text', () => {
  const nodes = parseNodes(DUMP);
  assert.equal(findNode(nodes, 'Definições')?.desc, 'Definições');
  assert.equal(findNode(nodes, 'Português')?.text, 'Português');
  assert.equal(findNode(nodes, /viagem/)?.desc, 'Ver a sua viagem');
  assert.equal(findNode(nodes, 'Apagar tudo'), null);
});

test('a tap lands in the middle of the control', () => {
  assert.deepEqual(centre({ bounds: [24, 96, 204, 276] }), [114, 186]);
});

test('a crash is this app’s only when its process is named', () => {
  // The two shapes the crash buffer holds, trimmed from real Android output.
  const buffer = [
    '09-25 09:01:02.123  1234  1234 E AndroidRuntime: FATAL EXCEPTION: main',
    '09-25 09:01:02.123  1234  1234 E AndroidRuntime: Process: com.proa.madeira, PID: 1234',
    '09-25 09:01:02.124  1234  1234 E AndroidRuntime: java.lang.NullPointerException',
    '09-25 09:05:00.000  4321  4321 E AndroidRuntime: FATAL EXCEPTION: main',
    '09-25 09:05:00.000  4321  4321 E AndroidRuntime: Process: com.other.app, PID: 4321',
    '09-25 09:07:00.000  5555  5570 F libc    : Fatal signal 11 (SIGSEGV) in tid 5570 (mqt_js), pid 5555 (com.proa.madeira)',
  ].join('\n');
  const found = crashLines(buffer, 'com.proa.madeira');
  assert.equal(found.length, 2);
  assert.match(found[0], /FATAL EXCEPTION/);
  assert.match(found[1], /Fatal signal 11/);
  assert.deepEqual(crashLines('', 'com.proa.madeira'), []);
});

test('a row scrolled out of view is not found, so the caller scrolls to it', () => {
  const offscreen = parseNodes(
    '<node text="Licenças" content-desc="" bounds="[0,0][0,0]" /><node text="Idioma" bounds="[0,10][100,70]" />'
  );
  assert.equal(findNode(offscreen, 'Licenças'), null);
  assert.equal(findNode(offscreen, 'Idioma')?.text, 'Idioma');
});
