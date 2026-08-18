# How the souvenir video gets encoded

**T-105c.** The project lead asked for this explicitly: *"definitely something we should research
in the future."* ⇠ D-051, D-063, D-013

**Run:** 2026-08-18, desk research only. **Nothing here has been run on a device**, because there
is no device (`docs/dev-build.md`). Every timing claim below is marked as unmeasured.

---

## The verdict, first

**Write a small Expo local module over Android's own `MediaCodec` + `MediaMuxer`. Add no third
party.** The usual React Native answer is gone, its successors are unowned, and the platform API
underneath them has been the actual encoder all along.

**The network audit D-043 asks for is the shortest one this project will ever write: there is
nothing to audit.** `MediaCodec`, `MediaMuxer`, `EGL` and OpenGL ES are Android system APIs. No
package is added to `package.json`, no native artefact is fetched at build time, and no new code
of anyone else's ships. **T-117's verdict is unchanged by this work**, which is not true of any
option that adds a library.

---

## 1. `ffmpeg-kit` is dead. Confirmed.

TASKS said *"confirm that before anything depends on it"*. Confirmed:

- The maintainer announced retirement in January 2025.
- **The native binaries were removed from Maven Central, CocoaPods and npm on 1 April 2025.** Not
  deprecated — withdrawn. A build that resolves it today resolves nothing.
- The GitHub repository is archived; source and release archives remain, binaries do not.

**Forks exist and none has become the successor.** `FFmpegKitNext` and assorted community
republishes are the live ones. Rejecting them is not squeamishness about forks:

- **It is the largest dependency the app would carry**, by a distance, for one screen.
- **It is a whole media stack with a network-capable protocol layer compiled in** — the exact
  shape CONTEXT §4.8 says these apps leak through. Auditing it properly is a real piece of work
  that would have to be redone at every version bump.
- **It has no owner**, so that audit has no end date.

## 2. What the platform actually offers

The chain, all of it Android's own:

| | |
|---|---|
| `MediaCodec` | H.264 (`video/avc`) encoder, configured with `COLOR_FormatSurface` so it takes an input **Surface** rather than byte buffers |
| `EGL` + OpenGL ES | draws each frame's bitmap into that Surface |
| `MediaMuxer` | wraps the encoded samples in an MP4 container |

The reference implementations are Andy McFadden's `bigflake.com/mediacodec/` samples, which are
the canonical ones, and a published images-to-video timelapse walkthrough that does exactly our
job. **No third-party library appears anywhere in that chain.**

**Three pitfalls, recorded now so they are not discovered on the device:**

- ⚠ **The frame rate you configure is ignored.** `MediaMuxer` takes its timing from
  `BufferInfo.presentationTimeUs`, which the caller sets per frame. Our storyboard is already in
  absolute milliseconds (`composition.ts`), so this is a multiplication — but get it wrong and the
  film plays at the wrong speed with no error anywhere.
- ⚠ **Drain the output before feeding more input**, or the encoder blocks. A hang, not a crash.
- ⚠ **1080 × 1920 is not guaranteed on every device.** `MediaCodecInfo.VideoCapabilities` says
  what a given phone supports, and it must be asked rather than assumed. This is the one that
  will bite on a cheap Android, which is exactly the phone T-105b needs to be tested on.

**iOS, for later:** `AVAssetWriter` + `AVAssetWriterInputPixelBufferAdaptor` is the same shape,
also a system API, also nothing to audit. There is no iOS build (D-032), so this is a note, not a
plan.

## 3. The real open question is not the encoder

The encoder takes frames. **We do not yet have a way to produce frame N.**

`composition.ts` (T-105a, done, tested) already answers *what is the film* — scenes, camera path,
strokes, the moment each stamp lands, all in absolute milliseconds. What is missing is the step
between that and a bitmap. Three ways, and this is the decision worth making deliberately:

**(a) Sample the storyboard in JS, draw with `react-native-svg`, photograph with `captureRef`.**
Reuses everything already built and verified — `shareCard.ts` composes and `shareTrip.ts` already
photographs a mounted view for the still souvenir (T-105d/T-107). One renderer, no divergence.
⚠ **The risk is time.** Five seconds at 30 fps is 150 captures, each a GPU-to-CPU readback of a
1080 × 1920 view. **Nobody has measured this**, and T-109 gives the whole render ~30 seconds. If
each capture costs 200 ms this option is already over budget on its own.

**(b) Draw the frames natively, in the module.** Fast, and the frames never leave the GPU. ⚠ It
means a **second implementation of the drawing**, in Kotlin, that can silently disagree with the
one on screen. This project keeps second renderers deliberately (`tools/preview-stamps.mjs`) —
but as a *check* on the shipping one, never as a second shipping one.

**(c) `react-native-skia` offscreen surfaces.** Draw each frame to an offscreen Skia surface and
hand the pixels over. Fast and well-maintained. ⚠ It is a **large new dependency to audit**, and
it would be the second drawing stack in an app that already has `react-native-svg`.

**The recommendation is (a), with a measurement gate.** Build the frame sampler — pure, testable
on Node today — and measure `captureRef` on the first real device before committing. If it is too
slow, the fallback is (b) for the trace layer only, since the trace is the part that changes every
frame and the rest of the card is static and can be composited once.

## 4. What can be built with no device, and what cannot

**No device needed — this is the work available today:**

- `frameAt(composition, tMs)` — a pure sampler turning the storyboard into a drawable frame
  state. The same shape as everything else here: arithmetic, in its own module, tested on Node.
- A preview tool writing frames to disk, so the film can be **looked at** as a strip of stills
  before any encoder exists. The project's standing rule is that anything visual gets a second
  renderer and gets looked at (`tools/preview-stamps.mjs`, `tools/preview-souvenir.mjs`).

**Device needed, and nothing substitutes:**

- The encoder itself. An emulator's `MediaCodec` is a software codec and says nothing about
  whether a real phone can do 1080 × 1920, or how long it takes.
- **T-105b's deliverable stands: one five-second MP4 written on a real Android.** Until that file
  exists the video is unproven, and per T-105b it is *"not a commitment yet — a spike"*.

## 5. What this costs, honestly

A native module is the first Kotlin in this project. It is roughly 300 lines of well-trodden,
heavily-exampled code, and it cannot be tested by any test this repo can run. Against that: no
dependency, no audit, no maintainer to outlive, and no risk of a media library phoning home —
which is the failure CONTEXT §4.8 exists to prevent and the reason `docs/dependency-audit.md` was
worth writing.

⚠ **And the premise deserves stating.** `docs/competitors.md` records, checked the same day, that
**WalkNYC ships no video at all** and is successful anyway. The video is a bet this project is
making and the reference app is not. It may well be the right bet — D-013's argument for it never
rested on WalkNYC — but it should be made knowingly, because this is the largest remaining piece
of v1 and the one that most needs hardware.
