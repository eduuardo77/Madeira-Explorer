/**
 * Measure every screen in the design workbench (T-112, T-113, D-038).
 *
 *     cd app && npm run web        # the workbench, on :8081
 *     …then evaluate this file in the page and read the report.
 *
 * WHY THIS IS A FILE AND NOT A PARAGRAPH IN A COMMIT MESSAGE
 * ---------------------------------------------------------
 * T-113 closed by measuring every control in the workbench, and
 * `accessibility.test.ts` says plainly what that cost: *"it cannot run in CI,
 * because it needs a browser and a running Metro server"*, so the rules it
 * keeps are the ones that catch **regressions a measurement would only find if
 * somebody remembered to re-run it.** T-144 then added *See all* — a 41 × 19 dp
 * word — and nobody remembered. It shipped at 57 × 35 against a 60 dp floor.
 *
 * Retyping the measurement from memory is what does not happen. Pasting a file
 * does.
 *
 * WHAT IT CHECKS, AND WHAT IT CANNOT
 * ----------------------------------
 * Checks: every control's rendered size against 60 dp; controls overlapping
 * each other; text clipped rather than wrapped; content painted outside the
 * screen's own width.
 *
 * ⚠ **It cannot see `hitSlop`.** react-native-web does not render it, so a
 * control reported here as 41 × 19 may be a perfectly good target on a device
 * — or may not. Read the size as *the word*, then read the code. That gap is
 * exactly how the *See all* defect survived a measurement pass, and it is why
 * `accessibility.test.ts` now refuses a `hitSlop` written as one number.
 *
 * ⚠ **It measures a browser, not a phone.** Layout, not rendering: it says
 * nothing about colour on a real panel, about the map underneath, or about
 * anything outdoors (T-065).
 */

(() => {
  /** The 60 dp floor from `theme.ts` — D-015 chose it over the platform's 44. */
  const MIN_TAP_TARGET = 60;

  /**
   * The screen under test: the workbench draws its pickers above and the phone
   * below, so the viewport-sized box furthest down the page is the app.
   */
  const phone = () => {
    const boxes = [...document.querySelectorAll('div')].filter((element) => {
      const box = element.getBoundingClientRect();
      return (
        Math.abs(box.width - window.innerWidth) < 2 &&
        Math.abs(box.height - window.innerHeight) < 2
      );
    });
    return boxes[boxes.length - 1] ?? null;
  };

  /**
   * The screen names, read off the workbench's own picker.
   *
   * ⚠ Anything **above** the phone frame, and nothing inside it. Matching on
   * the text alone picked up a row of the settings screen that happened to
   * start with the same word, and then clicked it — the audit was driving the
   * app rather than the picker.
   */
  const screens = () => {
    const top = phone()?.getBoundingClientRect().top ?? Infinity;
    const names = [...document.querySelectorAll('div')]
      .filter(
        (element) =>
          element.children.length === 0 &&
          element.getBoundingClientRect().bottom <= top &&
          element.textContent.trim() !== ''
      )
      .map((element) => element.textContent.trim());
    // The picker also holds the four stamp-count scenarios and the page's own
    // heading, neither of which is a screen to navigate to.
    return [...new Set(names)].filter(
      (name) => !/^\d+ stamps/.test(name) && !/workbench/i.test(name)
    );
  };

  const show = (label) => {
    const matches = [...document.querySelectorAll('div,span')].filter(
      (element) => element.textContent.trim() === label && element.children.length <= 1
    );
    matches[matches.length - 1]?.click();
  };

  const nameOf = (element) =>
    (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 46);

  const audit = () => {
    const screen = phone();
    if (screen === null) {
      return { error: 'no phone-sized frame — is the workbench loaded?' };
    }
    const frame = screen.getBoundingClientRect();

    const controls = [...screen.querySelectorAll('[role="button"],button')]
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter((control) => control.box.width > 0);

    const undersized = controls
      .filter(
        (control) =>
          control.box.width < MIN_TAP_TARGET || control.box.height < MIN_TAP_TARGET
      )
      .map((control) => ({
        control: nameOf(control.element),
        size: `${Math.round(control.box.width)}x${Math.round(control.box.height)}`,
        // How much room there is to grow into before another control is hit.
        room: clearance(control, controls),
      }));

    const overlapping = [];
    for (let i = 0; i < controls.length; i += 1) {
      for (let j = i + 1; j < controls.length; j += 1) {
        const a = controls[i];
        const b = controls[j];
        // A control inside another is a layout, not a collision.
        if (a.element.contains(b.element) || b.element.contains(a.element)) {
          continue;
        }
        const width = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
        const height = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
        if (width > 1 && height > 1) {
          overlapping.push({
            a: nameOf(a.element),
            b: nameOf(b.element),
            by: `${Math.round(width)}x${Math.round(height)}`,
          });
        }
      }
    }

    const leaves = [...screen.querySelectorAll('div,span')].filter(
      (element) => element.children.length === 0
    );

    return {
      controls: controls.length,
      undersized,
      overlapping,
      // Cut rather than wrapped. The fix is always a taller box, never
      // `allowFontScaling={false}` (D-015, CONTEXT §6.5).
      clippedText: leaves
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent.slice(0, 40)),
      // Painted outside the screen's width. A horizontal strip is allowed to
      // (that is what swiping is for); anything else is off the edge.
      offScreen: leaves
        .map((element) => ({ element, box: element.getBoundingClientRect() }))
        .filter(
          (item) =>
            item.box.width > 0 &&
            (item.box.left < frame.left - 1 || item.box.right > frame.right + 1)
        )
        .map((item) => nameOf(item.element))
        .slice(0, 5),
    };
  };

  /** Clear space around a control, in dp, before the nearest other one. */
  const clearance = (control, controls) => {
    const near = controls.filter(
      (other) =>
        other !== control &&
        other.box.right > control.box.left - 30 &&
        other.box.left < control.box.right + 30
    );
    const above = near
      .filter((other) => other.box.bottom <= control.box.top)
      .sort((a, b) => b.box.bottom - a.box.bottom)[0];
    const below = near
      .filter((other) => other.box.top >= control.box.bottom)
      .sort((a, b) => a.box.top - b.box.top)[0];
    return {
      above: above === undefined ? null : Math.round(control.box.top - above.box.bottom),
      below: below === undefined ? null : Math.round(below.box.top - control.box.bottom),
    };
  };

  return (async () => {
    const report = {};
    for (const screen of screens()) {
      show(screen);
      // One frame is not enough for a screen that mounts a list.
      await new Promise((resolve) => setTimeout(resolve, 150));
      report[screen] = audit();
    }
    return { viewport: [window.innerWidth, window.innerHeight], report };
  })();
})();
