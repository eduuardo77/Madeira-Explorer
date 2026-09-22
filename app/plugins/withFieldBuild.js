/**
 * A release build whose database can still be read over adb — opt-in, for
 * field work only.
 *
 *     cd app/android && ./gradlew assembleRelease -PproaFieldBuild=true
 *
 * WHY THIS EXISTS
 * ---------------
 * A real walk has to be recorded by a **release** build: bundled, minified,
 * no dev client, no Metro. The dev-client build cannot even open without a
 * laptop serving it, and every impression of how it performs is of the dev
 * build (docs/reference-app-teardown.md, item 12).
 *
 * But a release build is not debuggable, and **`run-as` is the only way this
 * project gets the database off a phone** — `adb backup` returns an empty
 * 47-byte file on the Huawei P30 (tested 2026-09-22), and `tools/soak-check.sh`
 * reads the WAL's mtime through `run-as` too. A walk recorded on a build we
 * cannot read is a walk we lose.
 *
 * ⚠ WHY NOT `debuggable true` ON THE BUILD TYPE
 * ---------------------------------------------
 * That also sets `BuildConfig.DEBUG`, which `MainApplication` hands to React
 * Native as `useDeveloperSupport` — and the app goes looking for Metro again,
 * the exact thing a release build exists to stop. So only the **manifest**
 * says debuggable: the OS allows `run-as`, and the app still runs its own
 * bundled JS with developer support off.
 *
 * ⚠ It is not free. ART runs a debuggable app's Kotlin/Java less optimised, so
 * **measure smoothness on a build without the flag**, never on a field build.
 * Without `-PproaFieldBuild=true` the placeholder is `false` and the release is
 * exactly what it was. Play rejects a debuggable upload, so one cannot ship by
 * accident.
 */

const { withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins');

const MARK = 'proaFieldBuild';

module.exports = function withFieldBuild(config) {
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    app.$['android:debuggable'] = '${proaDebuggable}';
    // Lint's HardcodedDebugMode is fatal in lintVitalRelease; the value here
    // is a placeholder chosen per build type below, not a hardcoded `true`.
    const ignore = (app.$['tools:ignore'] || '').split(',').filter(Boolean);
    if (!ignore.includes('HardcodedDebugMode')) ignore.push('HardcodedDebugMode');
    app.$['tools:ignore'] = ignore.join(',');
    return cfg;
  });

  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARK)) return cfg; // already applied

    const anchor = '        debug {\n            signingConfig signingConfigs.debug\n';
    const releaseAnchor = '            minifyEnabled enableMinifyInReleaseBuilds\n';
    if (!gradle.includes(anchor) || !gradle.includes(releaseAnchor)) {
      // ⚠ Loud: without the placeholder the manifest will not merge at all.
      console.warn(
        '\n⚠ withFieldBuild: build type anchors not found, so the debuggable ' +
          'placeholder was NOT set. Check android/app/build.gradle.\n'
      );
      return cfg;
    }

    gradle = gradle.replace(
      anchor,
      `${anchor}            manifestPlaceholders += [proaDebuggable: "true"]\n`
    );
    gradle = gradle.replace(
      releaseAnchor,
      `            // plugins/withFieldBuild.js — debuggable only with -P${MARK}=true.\n` +
        `            manifestPlaceholders += [proaDebuggable: (findProperty('${MARK}') ?: 'false').toString()]\n` +
        releaseAnchor
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
