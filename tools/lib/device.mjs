/**
 * Driving an attached Android phone over adb: read the screen, find a control
 * by its label, tap it, take a screenshot (T-222).
 *
 * The impure half of `uiTree.mjs`, shared by `tools/smoke-release.mjs` and any
 * one-off look at the phone, so each script does not grow its own copy.
 *
 * ⚠ adb is called directly, never through a shell: Git Bash rewrites
 * `/sdcard/...` into a Windows path, and a dump written there is never found.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { centre, findNode, parseNodes } from './uiTree.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ADB = path.join(root, 'tools', 'android-sdk', 'platform-tools', 'adb');

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A connection to one phone, or to the only one attached when `serial` is null. */
export function device(serial = null) {
  const adb = (...args) =>
    execFileSync(ADB, [...(serial === null ? [] : ['-s', serial]), ...args], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  const shell = (command) => adb('shell', command).trim();

  /** What is on screen now. Retried: `uiautomator` refuses while anything animates. */
  async function screen() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        shell('uiautomator dump /sdcard/proa-ui.xml');
        return parseNodes(adb('exec-out', 'cat', '/sdcard/proa-ui.xml'));
      } catch {
        await pause(700);
      }
    }
    throw new Error('uiautomator could not read the screen');
  }

  const size = () => shell('wm size').match(/(\d+)x(\d+)/).slice(1).map(Number);

  /** Wait until `target` (a label, or a RegExp) is on screen, scrolling if asked. */
  async function reach(target, { scroll = false, timeoutMs = 12_000 } = {}) {
    const until = Date.now() + timeoutMs;
    for (let swipes = 0; Date.now() < until; ) {
      const node = findNode(await screen(), target);
      if (node !== null) {
        return node;
      }
      if (scroll && swipes < 10) {
        const [width, height] = size();
        shell(`input swipe ${width / 2} ${height * 0.75} ${width / 2} ${height * 0.35} 300`);
        swipes += 1;
        await pause(400);
      } else {
        await pause(600);
      }
    }
    throw new Error(`never appeared: ${target}`);
  }

  async function tap(target, options) {
    const node = await reach(target, options);
    const [x, y] = centre(node);
    shell(`input tap ${x} ${y}`);
    await pause(900);
    return node;
  }

  /** A PNG of the screen, written to `file`. */
  function screenshot(file) {
    const png = execFileSync(ADB, [...(serial === null ? [] : ['-s', serial]), 'exec-out', 'screencap', '-p'], {
      maxBuffer: 64 * 1024 * 1024,
    });
    writeFileSync(file, png);
  }

  return { adb, shell, screen, reach, tap, size, screenshot };
}
