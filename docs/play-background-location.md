# Play background-location declaration (T-123)

What to paste into Play Console, *App content → Sensitive permissions → Location permissions*, and
the video to attach. Drafted 2026-10-07 against Google's requirements as read that day
([Requesting location in the background](https://support.google.com/googleplay/android-developer/answer/9799150)):
describe **one** feature, say why it cannot work without background access, and show in a video
of about 30 seconds *"the prominent in-app disclosure"*, *"the runtime prompt"* and *"the feature
being activated from the background"*. Google lists *"health/fitness"* among the significant user
benefits. **Not legal advice.**

## The feature (paste as the description)

> Bruma lights up, on a map, every road and path the user has walked or driven on Madeira, and
> collects a stamp when they visit one of 80 places. Recording happens in the background so the
> map fills in while the phone stays in a pocket on a day out: a walk along a levada, a drive
> round the island. Foreground-only location cannot do this. A walker does not keep a map app
> open for hours, the screen turns off, and every road taken with the app closed would be missing
> from their map, which is the whole product. The user is told before they are asked (the
> disclosure in the video), can refuse and keep using the app by starting and stopping each
> outing themselves, and can turn background recording off at any time in Settings. Location
> never leaves the phone: no account, no server, and the trip is stored only on the device.

## Why each element is met

| Requirement (Google's words) | Where in the app |
|---|---|
| Disclosure *"Must include the term 'location'"* | *"collects location data"* (`onboarding.always.body1`, `onboarding.background.body1`) |
| One of *"background" / "when the app is closed" / "always in use" / "when the app is not in use"* | *"even when the app is closed or not in use"* |
| How the data is used | *"used only to draw your map, here on your phone. It never reaches us, is never sold, and is never used for advertising"* (`onboarding.always.note`) |
| *"Displayed in the normal usage of the app"*, before the runtime prompt | First run's card, then the system's own choice (T-121, T-250); the same screens when the map's notice asks again (D-095) |
| A way to say no | *"No, I'll start it myself"*: the app stays usable with *Start an outing* (D-008) |

`i18n.test.ts` fails the build if a translation drops "location", "closed or not in use" or the use.

## The video: about 30 seconds, in English

Set the app to English first (*Definições → Idioma*), so the reviewer reads the disclosure.
Three shots, cut together (any phone video editor, or ask me):

1. **0 to 10 s, the disclosure.** First run's *"Keep your phone in your pocket"* card: hold it long
   enough to read, then tap *Continue*.
2. **10 to 18 s, the runtime prompt.** Android's location screen; choose *Allow all the time*. It
   follows the phone's language, not the app's: on a Portuguese phone it reads *Permitir sempre*,
   which reviewers accept, but filming it on the English emulator avoids the question.
3. **18 to 30 s, the feature from the background.** The home screen with Bruma closed and its
   notification *"Recording your trip"* showing; then open Bruma: the roads travelled while it was
   closed are lit, and the status line says how far today.

**How to film:** shots 1 and 2 need a fresh install, which the P30 is not (and erasing it would
lose the lead's trips). I can film them on the emulator with `adb shell screenrecord`. Shot 3 is
best from the P30 after an outing with the app closed: its built-in screen recorder, from the
quick settings panel. Then join the three.

## After submission

Record the date submitted and Google's answer in TASKS (T-123). A rejection usually names the
missing element; the table above is where to look first.
