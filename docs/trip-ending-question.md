# When should a trip end? (open, the lead is not sure)

**2026-11-22: choice B is in** (the lead: "Yes, do that too"): silence no longer ends a trip,
on the P30 since 10:49 (D-088 amended). The rest of this page (C, the questions) is still open.

**Opened 2026-11-21**, after the lead's own trip ended without them noticing and they read it as
all their data gone. Not a decision yet: this is the question, what happened, and the choices.

## How it works today (D-088)

A trip ends in one of three ways (`app/src/progress/tripEnd.ts`):

1. **At the airport**, on the way out (the departure geofence).
2. **After three days with nothing recorded** (`INACTIVITY_END_MS`). Added for residents, long
   stays and a phone switched off on the flight, who never reach the departure geofence.
3. **By hand**: *Terminar viagem* at the bottom of the passport.

When a trip ends, the next movement starts a new one, and **the map, the passport and the km count
show the current trip only**. The old trip stays in the database, untouched.

## What happened on 21 Nov

- The P30 recorded nothing from 12 Nov to 21 Nov.
- At 06:03 on 21 Nov the first fix closed trip 31 (24 Sep to 12 Nov: 41,849 fixes, all 26 stamps,
  Porto Moniz, Câmara de Lobos and the rest) as `inactivity` and opened trip 33.
- The map showed only that day's 98 km, the passport 6 of 81. Nothing was deleted, but nothing on
  screen said where the rest had gone.
- Fixed by hand the same evening: trip 33 folded into trip 31 and 31 reopened (backup
  `Madeira-fieldwork/backups/p30-2026-11-21-before-merge`). Today's six stamps were all places
  already stamped in 31, so those duplicates were dropped; every fix was kept (49,537 before and
  after). **The rule is unchanged, so three quiet days will end the trip again.**

## Why it is a real problem, not just a one-off

- **A resident has quiet days all the time.** Three days at home is normal, so the rule ends their
  trip every week or two, and each time the map looks wiped.
- **The product is "where you have been"** (the lit roads). Hiding most of it after a quiet weekend
  works against the one thing the app is for.
- **It happens silently.** The only sign is the reveal notification at the moment of ending,
  which reads as good news, not as "your map is about to look empty".
- **A visitor is hit too**: a three day trip to Porto Santo, or a few days ill in the hotel,
  splits one holiday in two.

## The choices

| | What changes | For | Against |
|---|---|---|---|
| **A. Keep it** | Nothing | Already built and tested | Residents see their map emptied regularly |
| **B. No silence ending** | Only the airport and the button end a trip | One line in `tripEnd.ts` | A visitor whose phone skips the airport geofence never gets the film or a fresh passport next year |
| **C. Everything adds up** | The map, the km and the passport show all trips together; a trip becomes a chapter in the trip viewer and the film | Nothing ever looks lost; fits "where you have been"; a returning visitor keeps their stamps | Bigger change: the passport, the map, the summary and the film all read one trip today; what does a visitor's second holiday start from? |
| **D. Ask instead of ending** | After three quiet days, a notification: *Continuar a viagem ou terminar?*; no answer means it continues | The user decides; no surprise | One more notification; a forgotten question leaves a trip open for months, as B does |

**Leaning: C**, perhaps with B's simpler rule underneath while C is built. Not decided: this
needs the lead's word (tier 3, CONTEXT §9).

## Questions for the lead

1. Should a quiet spell ever end a trip on its own?
2. Should your map and stamps always show everything you have ever done, whatever the trips?
3. For a visitor who comes back a year later: their old stamps, or a fresh passport?
