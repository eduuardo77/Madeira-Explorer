# Video spike (T-329)

A throwaway Android app, `com.proa.videospike`, that answers one question before the export
is built into Bruma: **can the phone draw Bruma's own map frame by frame and encode the
film into an MP4, and how long does it take?** It never touches Bruma or its data, and is
never shipped.

For every frame of the film it moves a MapLibre `MapView`'s camera, waits until the map is
idle (fully drawn), takes the map's picture, draws the lit roads on it with a `Canvas`,
encodes H.264 through `MediaCodec`, and at the end saves the MP4 to `Movies/BrumaSpike`. It
writes `result.json` (the time each step took) and keeps frames 0, 270 and 540 as PNGs, so
the result can be **looked at**, not only timed.

## What it found (P30, EMUI 12, Android 10, 24 Nov 2026)

Trip 31's film, 18.2 s, 547 frames at 1080x1920 and 30 fps: **made in 157 s** (8.6 times its
length), all 547 frames written, 20.3 MB at 10 Mbit/s. Map per frame: median 112 ms, 90th
percentile 150 ms. Roads, YUV conversion and encoding: median 158 ms, 90th 233 ms (all in
plain Kotlin, the obvious place to save time). Checked by extracting frames with ffmpeg.

**Made faster the next day (25 Nov): 61 s**, 2.6 times quicker, the same 547 frames, checked
with ffmpeg. Three changes, in `RoadPainter.kt` and `FrameEncoder.kt`:

- Road positions by Web Mercator from the frame's camera instead of one `toScreenLocation`
  call per point (checked against MapLibre on frame 0: under 0.01 px apart).
- RGB to YUV into plain arrays on four threads, then into the encoder's buffers in bulk,
  instead of a byte at a time.
- A worker thread draws the roads and encodes while the map draws the next frame (at most
  two pictures waiting, 8 MB each).

Per frame now: map median 94 ms (three screen refreshes of waiting, then the picture's
read-back), roads 55 ms, encoding 35 ms; the map is now the whole of the time. Going
further means waiting fewer refreshes (tiles might be missing) or taking the picture off the
GPU without the read-back.

**With the overlays (25 Nov): 71 s** for 20.4 s of video (the film and the free end card),
613 frames. `OverlayPainter.kt` draws what `app/src/souvenir/videoOverlay.ts` says each frame
holds; the job carries it frame by frame (`--info full|discreet|none`, `--tier free|paid`).

Three traps on the way, each of which looked like a result:

- **`MapSnapshotter`** answered the first request and then never again, and in one run returned
  the same picture for all 546 frames: the timing looked good and measured nothing.
- **MapLibre's idle and "rendered fully" signals** never arrived after `moveCamera` here, so
  each frame waited a 3 s fallback. The frame now waits three screen refreshes (sixty for the
  first, while tiles load), and frames 0, 270 and 540 are kept as PNGs to check.
- **The browser pane's video player** showed one repeated picture for a correct MP4. Decode with
  ffmpeg (`imageio_ffmpeg` ships one) before believing a player. Drawing into the encoder's
  input Surface was replaced by YUV buffers with our own timestamps during that confusion; it
  is the more portable route anyway.

Always look at the frames.

## Run it

```bash
# 1. The job: this trip's frames, pen strokes and resolved style (any copy of madeira.db).
node tools/preview-video-options.mjs --db <copy of madeira.db> --spike <dir>

# 2. Build (the app's own Gradle wrapper) and install beside Bruma.
app/android/gradlew -p tools/video-spike assembleDebug
adb install -r tools/video-spike/app/build/outputs/apk/debug/app-debug.apk

# 3. Its files: the map, the fonts, the job.
D=/sdcard/Android/data/com.proa.videospike/files
adb push app/assets/map/madeira.pmtiles app/assets/map/madeira-terrain.pmtiles app/assets/map/fonts $D/
adb push <dir>/job.json <dir>/style.json $D/

# 4. Run, then read the result and pull the frames.
adb shell am start -n com.proa.videospike/.MainActivity
adb shell cat $D/result.json
```

`MSYS_NO_PATHCONV=1` in Git Bash, or adb receives Windows paths for the phone's.
