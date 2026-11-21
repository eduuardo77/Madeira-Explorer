# Why a driven road went unlit, and how to fix it (T-313)

**2026-11-21, research.** The lead drove Poiso to above Parque Ecológico on 21 Nov and the map
left 1.8 km of it dark. They called it a bad mistake of the app, to be treated seriously. The app
was not changed; a prototype sits on branch `t313-corridor-prototype` (`dbadb82`).

## What happened

- From 13:24:30 to 13:27:05 the P30's fixes sat **40 to 170 m off the ER103** while the iPhone
  beside it stayed within 10 m of the road in `content/roads.json`. The P30 still claimed to be
  precise: 20 m when it was 169 m off, 6 m when it was 71 m off.
- The matcher looks for roads only within 25 to 100 m of a fix, depending on its reported
  accuracy. Three fixes in a row with no road close enough end the chain (`MAX_SKIPPED_FIXES`).
- Two chains 3 min 16 s apart are joined only when the road between them goes through a tunnel
  (`joinThroughTunnels`, T-279). Anywhere else the rule is "a break is the honest answer". So the
  road between the two chains stayed dark, though the car obviously drove it.

The road data was right and the matcher followed its own rule. The rule is what is wrong: one
bad patch of GPS should not cost a road the user plainly drove.

## The prototype: join along the road when the fixes stay close to it

When a chain ends and the next starts at most 5 min later (`MAX_BRIDGE_S`, as now), take the
shortest road from the end of one to the start of the other. Join them along it when:

1. the road is no longer than twice the straight line plus 300 m, and no faster than 50 m/s
   (the bounds the matcher already uses), and
2. **every fix recorded in between lies within 150 m of that road** (`CORRIDOR_JOIN_M`).

Condition 2 is what keeps it honest. A walk on a beach, a boat trip or a square stays unlit when
its fixes are more than 150 m from any road that links the two ends.

## Measured on every day with an iPhone reference

All 16 SensorLogger days, through `tools/compare-sensorlogger.mjs` on the merged database.
*Recall*: how much of the iPhone's route has a lit line within 30 m. *Precision*: how much of the
lit line is within 30 m of the iPhone's route, so a drop means wrong roads lit.

| Day | Recall now | With the join (150 m) | Precision now | With the join |
|---|---|---|---|---|
| 21 Nov, sightseeing | 94.8% | **96.6%** | 96.1% | 96.1% |
| 13 other days | unchanged | unchanged | unchanged | unchanged |

- **It fires once in 16 days**, at the exact place the lead reported, and adds 2.2 km of correct
  line there. **Precision did not move on any day**, so it lit nothing wrong.
- **100 m is too narrow** (today's gap stays dark). **150 m and 250 m give the same numbers**,
  so 150 m is the safer choice with room to spare.
- 18 Oct's lit length moved by 21 m of 94 km, with recall and precision unchanged.
- 11 Oct (F1) and 6 Oct (ride) are left out: the P30 lit nothing or very little of them, with or
  without the join.

One existing test fails with the prototype, on purpose: *two chains a few minutes apart with no
tunnel between them stay two*. It states the rule being changed. In its layout the fixes run along
a road 100 m away that does not connect to either end, so the car can only have used the main
road, and the join is the right answer there. The test would become "the fixes between leave
the corridor, so the chains stay two". The beach test (fixes 200 m off every road) still passes.

## A second, separate problem found on the same day

Near Ribeiro Frio at 13:03 the chain was unbroken, but for **1.2 km it lit the old road** running
14 to 90 m beside the ER103 instead of the main road the iPhone was on (690 m of the route counted
as unlit). The P30's fixes happened to sit closer to the old road. That is the matcher choosing
the wrong one of two parallel roads, not a break; the fix would be in how a car at speed weighs a
main road against a minor one (`stepCosts`). Not prototyped yet.

Other misses across the 16 days are short (100 to 400 m), mostly in towns. The 1.2 km on 17 Oct
near Ribeira Brava is the recording, not the matcher: the P30 had no fixes until 12:30:48.

## Proposal

1. **Ship the corridor join** (T-313): the prototype plus tests (a join through a GPS bad patch;
   no join when the fixes in between leave the corridor; the beach case), and rewrite the old
   test. Needs the lead's yes: it reverses T-279's "only a tunnel" rule.
2. **Then look at the parallel roads** with the 13:03 case as the fixture.
3. Check it on the next drive with the iPhone alongside.
