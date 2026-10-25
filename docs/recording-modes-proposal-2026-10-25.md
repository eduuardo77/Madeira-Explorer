# Recording modes: a proposal (25 Oct 2026)

**Status: proposed, not decided.** It replaces the three tiers of T-146 (D-041 on battery figures
stays as it is), so it needs the project lead's approval before it
becomes a decision or touches the app. Nothing in the app has changed.

## The problem

The project lead cannot tell *Poupança*, *Equilibrado* and *Preciso* apart, and the screen does
not help:

- The names describe a feeling, not a behaviour, and only the chosen mode's sentence is shown.
- **On Android the three modes are now nearly the same.** Since D-106 (11 Oct) every mode uses the
  GPS while moving, so Poupança lost the one thing that made it cheaper. What is left is how far
  apart the kept points are.
- **The GPS is on most of a day out in any mode.** On Equilibrado it was on 349 of 437 minutes
  (18 Oct) and 433 of 482 (17 Oct). A fix every 10 to 30 seconds keeps it on regardless.
- *Começar passeio* always records in Preciso, and the screen does not say so.

What each mode does today on the P30:

| | Poupança | Equilibrado | Preciso |
|---|---|---|---|
| On foot, a point every | 2 min / 60 m | 30 s / 20 m | 10 s / 5 m |
| By car, a point every | 1 min / 150 m | 15 s / 50 m | 10 s / 13 m |
| Points held before being saved | up to 15 min | up to 5 min | about 1 min |
| GPS when stopped | pauses | pauses | stays on |

What has been measured for each:

- **Equilibrado:** five carried days, about 88% of the route lit within 10 m, about 1.6 to 2.1%
  battery an hour on the P30.
- **Preciso:** only during outings, never a whole day with the app closed.
- **Poupança:** one trip, which failed (6 Oct, 29 points), under the behaviour that has since
  changed. Never retested.

## The desk replay (25 Oct)

The 16, 17 and 18 Oct trips, about 310 km, with the phone's fixes thinned to one every 1, 2 and
3 minutes and matched exactly as the app matches them, against the iPhone's SensorLogger track.
Share of the route lit within 10 m:

| Spacing | 16 Oct (71 km) | 17 Oct (125 km) | 18 Oct (115 km) | All three |
|---|---|---|---|---|
| As recorded (Equilibrado) | 90.3% | 84.0% | 91.4% | **88%** |
| 1 fix a minute | 79.2% | 80.5% | 86.4% | **82%** |
| 1 fix every 2 min | 60.5% | 75.8% | 82.7% | **75%** |
| 1 fix every 3 min | 57.9% | 55.2% | 74.9% | **63%** |

- The first row reproduces the field log (90.1, 83.1, 91.4), so the replay measures what it
  should.
- What does light stays in the right place (81 to 95% within 10 m at every spacing). Thinning
  loses roads; it does not invent wrong ones.
- Losses come in large pieces: whole stretches of driving of 3 to 6 km, where the matcher will not
  bridge a gap of several kilometres, often across tunnels.
- Too kind on fixes: each was taken with the GPS already warm. Too harsh on matching: the matcher
  is tuned for dense fixes (it gives up after 5 minutes, breaks after 90 s off the road network,
  needs 4 fixes per stretch). Mostly driving days, no levada.

## Where the battery goes

On 17 Oct the phone's battery statistics put about **half the drain on the cell radio searching
for a network** (the P30 has no SIM), **about a quarter on Bruma** (two thirds of that the GPS),
and the rest on the phone itself. If that holds, Bruma costs about **0.5% an hour**, 4 to 5% over a
full day. One estimate, one day, one phone, but it is the number every saving is measured against.

If it is right, a saver mode can save a few percent a day at a cost of 6 to 25% of the route. For
the part of the app that matters most, that is a bad trade.

⚠ **Rechecked the same day (measurement 1, from the desk): the 0.5% an hour is probably about
half the real figure.** The "quarter" was a share of Android's *estimated* drain, not of the real
one (commit `eee2462`: "about half of Android's estimated drain against about a quarter for
Bruma"), and the cell radio's estimate is the inflated term. The raw dumps of 16 to 18 Oct were
not saved and the phone has been charged since, so only the written summaries remain.

| Source | Bruma | GPS | How sure |
|---|---|---|---|
| Android's estimate, 16 Oct | 664 mAh of a real 621 to 694 (1.9% an hour, about all of it) | 505 of the 664, 76% | An upper bound: the model has no idle phone, no screen, no cell radio left over |
| Android's estimate, 17 Oct | a quarter of the *estimate* | two thirds of Bruma | Not convertible: the estimate's total was not recorded |
| 17 Oct against 18 Oct (airplane mode, Wi-Fi off) | | | Physical, ±0.2 an hour from whole-point steps, different routes |
| | 2.1 to 1.65% an hour: the cell radio plus Wi-Fi cost **at most 0.45 an hour**, about a fifth of 17 Oct, not half (the GPS was also on 10 points less of 18 Oct) | | |
| 18 Oct, by subtraction | **about 1.1 to 1.3% an hour**, 65 to 80% of that day | not separable from Bruma's CPU | 1.65 minus the phone's own floor and the screen, both assumed (0.2 to 0.3 each); not measured |
| 16 and 17 Oct, by subtraction | **about 1.2 to 1.3% an hour**, 55 to 65% of those days | | Same method, cell radio taken as 0.4 to 0.6 an hour from the 17 to 18 Oct gap and the still nights (0.46 to 0.8) |

**Best reading: Bruma about 1 to 1.3% an hour on the P30 while carried, two thirds to three
quarters of it the GPS (Android's model only), so 9 to 12% over a full day.** One phone, three
days, and two assumed terms; a control day (below) would replace them with a measurement.

**What it changes, and what it does not.** Bruma matters about twice as much as stated above, so
cutting GPS time is worth more. It does not rescue the step-down: it touches only driving, which
was 15 to 35% of these days by fix speed, and only while battery saver is on. Even if one fix a
minute halved the GPS while driving, that is about 0.1 to 0.15% an hour for the hours in saver,
under 1% of a day, for 6% of the route. The stops (item 4) touch about 30% of recording time
for every user at no cost to the line, which makes them the larger lever by several times.

**Control day, if wanted:** the 18 Oct setup (airplane mode, Wi-Fi off, unplugged around 80 to
90%, a similar day out by car with stops, the screen used about as much) with Bruma not recording
and no other app using location. Read afterwards: the % and time at leaving and at the plug,
`dumpsys batterystats` saved to `Madeira-fieldwork` before anything else (screen-on time, GPS time
per app, deep idle), and Huawei's battery screen. Bruma's cost is 18 Oct's rate minus that day's,
to about ±0.2 an hour. *Not run: the lead chose the desk estimate on 25 Oct. Neither the
step-down nor the saver question changes anywhere between 0.5 and 1.3 an hour, so it is only
worth a day if Bruma's absolute cost itself becomes the question (a store listing, Huawei's
warning).*

## Who it is for

**Tourists in Madeira for about a week.** No settings homework, no spare days (a missed Porto
Moniz is not repeated), a phone busy all day with photos and maps, a roaming SIM, and often an
iPhone. The default has to be right without them touching anything, and a lost day is worse than
a rougher line home.

## The proposal

1. **Two modes instead of three.**
   - **Normal:** the default, today's Equilibrado.
   - **Detalhado:** for walkers. It stays only if a levada walk shows Normal is not good enough
     there.
2. **Poupança goes.** Its job becomes an **automatic step-down**:
   - **Trigger:** the phone's own battery saver (*Poupança de energia* on Android, *Modo de baixo
     consumo* on iPhone). The user has already told the phone to save battery; a fixed level like
     20% would be a guess.
   - **What changes:** driving at one fix a minute (about 6 points of route in the replay).
     Walking and stamps unchanged.
   - **When it ends:** battery saver off, or the phone plugged in.
3. **It says so, quietly.** No notification. One line on that day's trip, for example: *"Com a
   poupança de energia ligada, o Bruma gravou com menos detalhe entre as 16:10 e as 18:30."* One
   switch in Settings, on by default: *"Gastar menos quando o telemóvel está a poupar bateria."*
4. **Cheaper for everyone:** spend less GPS time at stops. About 109 of 367 recording minutes on
   16 Oct were spent still; ending stops after 5 still minutes (17 Oct) saved about 11 of them.
   This costs the line nothing.
5. **Gaps are stated, not hidden:** a short note when a stretch had no position, so a missing
   piece never looks like a bug.
6. **Plain words, no technical figures.** Each mode says what it does in everyday terms. The GPS
   time line was considered and rejected as too technical. A battery figure appears only once it
   is measured (D-041).

Rejected along the way:

- **Three modes reworded.** Clearer words cannot fix modes that behave almost the same.
- **A rebuilt Poupança** (GPS on briefly every couple of minutes, line drawn along the road): the
  replay loses a quarter to a third of the route at 2 to 3 minutes.
- **Piggybacking on other apps' GPS** as the saver for heavy users: when Google Maps is
  navigating, the GPS is on anyway, so Bruma adds little GPS cost in exactly that case. Its main
  gain would be how Bruma looks on Android's battery screen.
- **Stamps only:** cheapest, but drops the lit roads, which are the product.
- **Asking each time, or stepping down silently:** one interrupts a struggling phone, the other
  makes a rougher line look like a bug.

## What still has to be measured, in order

1. **Bruma's own battery cost.** From the battery statistics of the days already carried; if they
   disagree, a control day with Bruma off. This decides how much any saving matters.
2. **GPS minutes at stops** still left to cut, by replaying the carried days.
3. **A levada walk** with the iPhone alongside: does Detalhado earn its place?
4. **A day in battery saver** on the P30. Android's battery saver may slow location down by
   itself, so the two could stack.
5. **The iPhone.** None of this has been checked there, and many tourists carry one. The modes
   should be defined by what the user gets, with each platform reaching it its own way.
