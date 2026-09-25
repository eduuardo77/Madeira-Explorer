/**
 * Reading an Android screen from `uiautomator dump` (T-222).
 *
 * The pure half of `tools/smoke-release.mjs`: XML in, nodes out, and the two
 * judgements the smoke test makes, *is this control on screen* and *did the app
 * crash*. Kept apart so they can be tested without a phone:
 *
 *     node --test tools/lib/uiTree.test.mjs
 *
 * ⚠ A regex reader, not an XML parser. `uiautomator` writes one `<node .../>`
 * per element with its attributes on one line, always the same ones; a parser
 * dependency for that would be the first npm package under `tools/`.
 */

/** One element on screen. `desc` is the accessibility label React Native sets. */
export function parseNodes(xml) {
  const nodes = [];
  for (const match of xml.matchAll(/<node\b([^>]*?)\/?>/g)) {
    const attrs = {};
    for (const attr of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
      attrs[attr[1]] = decodeEntities(attr[2]);
    }
    const bounds = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attrs.bounds ?? '');
    nodes.push({
      text: attrs.text ?? '',
      desc: attrs['content-desc'] ?? '',
      pkg: attrs.package ?? '',
      clickable: attrs.clickable === 'true',
      checkable: attrs.checkable === 'true',
      checked: attrs.checked === 'true',
      bounds: bounds === null ? null : bounds.slice(1).map(Number),
    });
  }
  return nodes;
}

function decodeEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&');
}

/**
 * The first node whose label or text is `label` exactly, or matches it when it
 * is a RegExp. The label wins over the text, because that is what a screen
 * reader and this app's own tests go by (T-215).
 */
export function findNode(nodes, label) {
  const hit = (value) =>
    label instanceof RegExp ? label.test(value) : value.trim() === label;
  return (
    nodes.find((node) => node.bounds !== null && hit(node.desc)) ??
    nodes.find((node) => node.bounds !== null && hit(node.text)) ??
    null
  );
}

/** Where to tap: the middle of the node. */
export function centre(node) {
  const [left, top, right, bottom] = node.bounds;
  return [Math.round((left + right) / 2), Math.round((top + bottom) / 2)];
}

/**
 * Lines of Android's crash buffer that belong to this app.
 *
 * `logcat -b crash` holds Java crashes (`FATAL EXCEPTION`) and native ones
 * (`Fatal signal`). In a release build a JavaScript error that nothing catches
 * also lands here, as the `JavascriptException` React Native rethrows.
 */
export function crashLines(crashBuffer, pkg) {
  const lines = crashBuffer.split(/\r?\n/);
  const found = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    // Native: the process is named on the same line, `pid 5555 (com.proa.madeira)`.
    if (/Fatal signal/.test(line) && line.includes(`(${pkg})`)) {
      found.push(line.trim());
    }
    // Java: `Process: com.proa.madeira, PID: …` follows the header. ⚠ Only the
    // very next line: a wider window reaches into the next app's crash.
    if (/FATAL EXCEPTION/.test(line) && (lines[index + 1] ?? '').includes(`Process: ${pkg},`)) {
      found.push(line.trim());
    }
  }
  return found;
}
