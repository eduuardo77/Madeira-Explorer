/**
 * Make a change to `content/` rebuild the JS bundle (T-180).
 *
 * ⚠⚠ WHAT WENT WRONG, 2026-09-22
 * ------------------------------
 * The P30 showed **0 / 67** places with `content/pois.json` at 80. The APK
 * carried a JS bundle from 20:25, before T-066c — *Encumeada Baixa*, which that
 * commit cut, was still in it, and none of its fourteen places were. Gradle
 * said why: `:app:createBundleReleaseJsAndAssets UP-TO-DATE`.
 *
 * The React Native Gradle plugin's bundle task takes as inputs the files under
 * its `root` — `app/`, minus `android`, `ios`, `build` and `node_modules`. The
 * app imports `../content/pois.json`, `levadas.json` and `regions.json` straight
 * into the bundle (`src/content/`), but `content/` sits at the repository root,
 * **outside `app/`**, so Gradle never saw it change. A content-only edit built
 * successfully and shipped the previous places. Nothing warned.
 *
 * WHY THIS AND NOT THE OBVIOUS FIX
 * --------------------------------
 * Moving `root` up to the repository would change the bundler's working
 * directory and pull every document into the task's inputs. Declaring the one
 * folder as an extra input is exactly the missing fact and nothing else.
 *
 * ⚠ `android/` is generated, so this has to be a config plugin. It appends one
 * marked block and does nothing if the marker is already there — which also
 * means it can be applied to an existing `android/` by hand without the
 * `prebuild --clean` that `docs/dev-build.md` warns changes the Maps SHA-1.
 */

const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = 'proaContentBundleInputs';

/**
 * `rootDir` is `app/android`, so `../../content` is the repository's
 * `content/`. Matched by name so it covers every variant's bundle task.
 */
const BLOCK = `
// ${MARK} — plugins/withContentBundleInputs.js (T-180). The JS imports
// ../content/*.json, which is outside the bundle task's inputs (app/ only):
// without this, a content-only change leaves the bundle UP-TO-DATE and stale.
tasks.matching { it.name.startsWith("createBundle") && it.name.endsWith("JsAndAssets") }.configureEach {
    inputs.dir(new File(rootDir, "../../content"))
        .withPropertyName("${MARK}")
        .withPathSensitivity(PathSensitivity.RELATIVE)
}
`;

function applyContentBundleInputs(contents) {
  return contents.includes(MARK) ? contents : contents + BLOCK;
}

module.exports = function withContentBundleInputs(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applyContentBundleInputs(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.applyContentBundleInputs = applyContentBundleInputs;
