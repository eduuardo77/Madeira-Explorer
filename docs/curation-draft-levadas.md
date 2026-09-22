# Levada draft — a list to veto, not to approve

> ✅ **Applied 2026-09-22 as drafted, all seven (T-066b).** The one change the project lead
> asked for: PR 6.2's start is ambiguous, so Alecrim (and Risco) carry two `start` geofences.

**For:** the project lead. **Written:** 2026-09-22. **Method:** D-064 draft-and-veto, under D-078's
loosening (*"the canvas may grow, and levadas especially"*). Same marks as
[`curation-draft.md`](curation-draft.md): `[osm]` checkable, `[knowledge]` my impression and
unverified, `[thin]` a question for you.

**The spine is the official PR network.** OSM carries every signed route as a relation with its
number, operator, distance and — since the 2024 fee law — `fee=yes`. A levada that is a PR is
signed, maintained and ticketed by the regional government, which is the nearest thing to *"worth
going to"* that can be checked from a laptop. Queried 2026-09-22.

## What the pack already covers

Of the **eight PR routes that are levadas**, six are in: 25 Fontes (PR 6), Caldeirão Verde (PR 9),
Furado (PR 10), Cedros (PR 14), Rei (PR 18), Rocha Vermelha (PR 28). ⚠ **Rocha Vermelha was
flagged `[thin]` in August — it is PR 28 now**, so that flag is retired.

## Add — seven proposed (11 → 18)

**Official PR levadas**

- **Levada do Risco** — `[osm PR 6.1, 3 km, fee]` Rabaçal to the Risco waterfall. The other half
  of the 25 Fontes morning, and the waterfall most people photograph up there `[knowledge]`.
  ⚠ Shares 25 Fontes' car park and its first stretch.
- **Levada do Alecrim** — `[osm PR 6.2, 3.5 km, fee]` Rabaçal up to the levada's source and the
  pools on the way `[knowledge]`. ⚠ **Your call: this makes three stamps from one car park.**
  Each is a separate signed walk to a separate place, but it's also three stamps in one morning.
- **Levada do Moinho** — `[osm PR 7, 10.3 km, fee]` Ribeira da Cruz to Junqueira, above Porto
  Moniz. ⚠ There's a second *Levada do Moinho* at Ponta do Sol. Matching by name alone would join
  the two, 20 km apart (`build-levadas.mjs` already caught that once), so this one's course has to
  come from the PR 7 relation instead.
- **Levada Fajã do Rodrigues** — `[osm PR 16, 3.9 km, fee]` Ginjas (São Vicente) through the
  tunnels to the waterfall `[knowledge]`. ⚠ I believe it closes often for rockfall — check it's
  open before a release.
- **Levada do Barreiro** — `[osm PR 4, 5.2 km, fee]` Poço da Neve down to Casa do Barreiro, above
  Funchal. ⚠ `[thin]` on merit: it's official, but I can't tell you it's a highlight, and I
  believe the area burned in 2010 and 2016 `[knowledge]`. **The most likely veto of the seven.**

**Not PR, but well walked**

- **Levada dos Tornos** — ⚠ cut in August as *"20 km of mixed suburban and rural"*. It's back on
  D-078: the Monte–Jasmine Tea House–Camacha section is the levada most visitors to Funchal walk
  `[knowledge]`. OSM has the southern section as its own route (`LTS`), so the course can be that
  section rather than all 37 km.
- **Levada do Caniçal** — ⚠ **borderline.** Maroços to the Caniçal tunnel, flat and easy, with
  the east coast below it `[knowledge]`. It was cut in August as "modest". I'm proposing it
  because the pack has only one easy levada in the east (Castelejo), not because it's a
  greatest hit.

## Considered, not proposed — pull any back

| | Why not |
|---|---|
| **Levada da Azenha** (PR 23) | ⚠ `[osm access=no]` — **the route is closed**. Official, but a stamp nobody can earn. |
| **Levada Velha do Rabaçal** (PR 6.4), **Levada do Paul II** (PR 6.8) | Official, but `[thin]`, and they'd be the fourth and fifth Rabaçal stamps. |
| **Levada Nova / Levada do Moinho, Ponta do Sol** | ⚠ `[knowledge]` a good circuit with a waterfall — but it carries the **same name as PR 7**, and two passport entries reading *Levada do Moinho* would confuse people. If you want it, it needs a name locals actually use. |
| **Levada do Paul** (Cristo Rei) | `[thin]` — an easy walk on the plateau; I can't defend it past that. |
| **Levada do Curral** | `[osm lwn]` Santo Amaro to Curral das Freiras. `[thin]`, and I believe parts are closed. |
| **Levada do Caldeirão do Inferno** | The extension past Caldeirão Verde; closed for years `[knowledge]`. |
| **Levada da Serra do Faial**, **Levada dos Piornais** | Cut in August for reasons that still hold — long and flat, and suburban. |

## What happens after you veto

1. For what survives, I take each course from its **PR relation** where the name is ambiguous or
   OSM's named ways are too short (Risco has 1 km of named path for a 3 km route; Barreiro
   0.1 km). That's a small change to `build-levadas.mjs`, keyed by place id.
2. Endpoints come from each relation's `from`/`to` ends. Since D-065, crediting uses coverage
   (60% of the course or 3 km), so the endpoints don't have to be exact.
3. `validate-content.mjs`, `build-regions.mjs --assign`, `build-levadas.mjs`, then the test suite.
   Anything that hard-codes *60 places* or *11 levadas* shows up there.
