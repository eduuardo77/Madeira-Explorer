# A first-run tutorial with a selling point: the idea

**Status: idea, not a decision.** The project lead, 2026-11-23: *"a tutorial when you first
install the app. A small step thing explaining the basics, with a paywall or a selling point
somewhere on it."* Nothing is built. When it is taken up, it becomes a task and the choices below
become a decision.

## What the first run is today

The onboarding cards (`app/src/onboarding/`, D-041, amended by T-250 and T-311): welcome, then
the permissions one at a time (location, *always*, activity, messages, the battery exemption),
then *ready*. They explain **why each permission is asked**, not **how the app works**. The
selling starts later, on the passport card (D-105, the free five counting down) and on the unlock
sheet (D-097).

So a new user grants five permissions and lands on a map with nothing on it, without having seen
a stamp, a lit road or what the passport is.

## The idea

Three or four short steps, mostly pictures, each one line long, **before the permission cards**:

1. **Your roads light up.** The map with a day of driving drawn in orange (the core of the app,
   `product-core-where-youve-been`). *"Anda. A app desenha onde estiveste."*
2. **Places give you stamps.** One stamp landing in the passport, the way the real one does.
   *"Chega a um dos 81 sítios e ganhas o carimbo."*
3. **The passport.** The passport page filling up, a medal on a full set. *"Cinco carimbos são
   teus de graça."*
4. **The selling point.** Not a wall, a page that can be swiped past: the founder stamp (paywall
   sketch E, `tools/out/paywall-options.html`) and the launch price. *"Quem desbloqueia nos
   primeiros três meses fica com o carimbo de fundador."* A button to buy, and *Agora não*,
   which is the default.

Then the permission cards as they are now, so step 1's picture explains why location is asked.

## What it must not break

- **Play's prominent disclosure (T-311, version 13 rejected for it).** The card naming
  background location must still come **before** Android's first location dialog. A tutorial in
  front of the permission cards is fine; one that asks for anything is not.
- **No gate (D-041, D-008).** Every step can be skipped, and the app works without paying.
- **Honest selling.** No "50% off" (D-110). The founder stamp ends on 21 Feb 2027 and the launch
  price on 28 Feb: after that, step 4 shows what is still true (the passport, the medals),
  driven by the same content dates as the unlock sheet.
- **No dashes in the copy**, in any language.
- **Short.** Each extra step loses people before they reach the map. Four is the most; three is
  better. A *Saltar* on every step.

## Open questions for the lead

1. **Buy on the tutorial, or only show?** Asking for money before the user has earned a single
   stamp sells a promise; the unlock sheet sells stamps they already have, which is stronger.
   One middle way: step 4 shows the founder stamp and the date, with no buy button, and the
   first unlock sheet repeats it.
2. **Pictures from the app or drawn?** Real screens from the demo database (`make-demo-db.mjs`,
   as the store screenshots) are honest and cheap; small animations look better and cost more.
3. **Shown again?** Once, and reachable from Settings, or never again.
4. **Porto Santo** in the steps, or left for when the user arrives there (D-024)?
