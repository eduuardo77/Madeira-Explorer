"""T-028 - OSM coverage survey for Madeira and Porto Santo.

Counts only; downloads no geometry, so it is cheap to re-run. Answers three
Phase 0 questions:

  - How large is the road graph we have to import and match against (T-082)?
  - Is OSM levada coverage good enough to build on, or must official PR-route
    data be licensed and reconciled in (OD-7, T-028)?
  - How many tunnels need portal pairs (T-069)?

Usage:  python tools/osm-survey.py

Results as of the last run are written up in docs/osm-coverage.md. Re-run
before relying on them; OSM changes continuously.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ENDPOINT = "https://overpass-api.de/api/interpreter"

# Madeira + Porto Santo + Desertas, as south,west,north,east.
# Both main islands are in scope per D-021; Desertas fall inside the natural
# bounding box and cost nothing (they are an uninhabited nature reserve).
BBOX = "32.40,-17.32,33.20,-16.20"

# Levadas carry their name on both the channel and the path beside it, so the
# name is the reliable selector - not any single tag. See docs/osm-coverage.md.
LEV = '["name"~"[Ll]evada"]'


def run(query, attempts=5):
    """Overpass is a shared free service and rate-limits (429) or times out
    (504) routinely. Back off rather than failing the run - be a good citizen."""
    req = urllib.request.Request(
        ENDPOINT,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": "madeira-explorer-phase0-survey"},
    )
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                data = json.load(resp)
            return [
                int(e["tags"]["total"])
                for e in data["elements"]
                if e.get("type") == "count"
            ]
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 504) or attempt == attempts - 1:
                sys.exit(f"Overpass returned {exc.code}.")
            wait = 30 * (attempt + 1)
            print(f"  ({exc.code} from Overpass; waiting {wait}s)", flush=True)
            time.sleep(wait)
    return []


NETWORK = (
    f"""
[out:json][timeout:300];
way["highway"]({BBOX})->.a;                                        .a out count;
way["highway"~"^(motorway|trunk|primary|secondary|tertiary)"]({BBOX})->.b; .b out count;
way["highway"="residential"]({BBOX})->.c;                          .c out count;
way["highway"="footway"]({BBOX})->.d;                              .d out count;
way["highway"="path"]({BBOX})->.e;                                 .e out count;
way["highway"="track"]({BBOX})->.f;                                .f out count;
way["highway"]["tunnel"]({BBOX})->.g;                              .g out count;
""",
    [
        "highway ways, all",
        "  major (motorway..tertiary)",
        "  residential",
        "  footway",
        "  path",
        "  track",
        "  with tunnel=*",
    ],
)

LEVADAS = (
    f"""
[out:json][timeout:300];
way{LEV}({BBOX})->.a;                          .a out count;
way{LEV}["highway"]({BBOX})->.b;               .b out count;
way{LEV}["highway"="path"]({BBOX})->.c;        .c out count;
way{LEV}["highway"="footway"]({BBOX})->.d;     .d out count;
way{LEV}["highway"="track"]({BBOX})->.e;       .e out count;
way{LEV}["waterway"]({BBOX})->.f;              .f out count;
way{LEV}["waterway"="drain"]({BBOX})->.g;      .g out count;
way{LEV}["waterway"="canal"]({BBOX})->.h;      .h out count;
way{LEV}["highway"]["tunnel"]({BBOX})->.i;     .i out count;
way{LEV}[!"highway"][!"waterway"][!"man_made"]({BBOX})->.j; .j out count;
""",
    [
        'ways named "Levada*", all',
        "  tagged highway=* (the walkable part)",
        "    highway=path",
        "    highway=footway",
        "    highway=track",
        "  tagged waterway=* (the channel)",
        "    waterway=drain",
        "    waterway=canal",
        "  highway=* AND tunnel=*  <- levada tunnels",
        "  none of highway/waterway/man_made",
    ],
)

CONTENT = (
    f"""
[out:json][timeout:300];
relation["route"="hiking"]({BBOX})->.a;             .a out count;
relation["route"="hiking"]["ref"~"^PR"]({BBOX})->.b; .b out count;
node["tourism"="viewpoint"]({BBOX})->.c;            .c out count;
node["natural"="peak"]({BBOX})->.d;                 .d out count;
node["waterway"="waterfall"]({BBOX})->.e;           .e out count;
node["place"~"^(city|town|village)$"]({BBOX})->.f;  .f out count;
""",
    [
        "hiking route relations",
        "  with ref PR*  <- official signed trails",
        "tourism=viewpoint nodes  (miradouros)",
        "natural=peak nodes",
        "waterfall ways",
        "place=city/town/village nodes",
    ],
)

if __name__ == "__main__":
    print(f"OSM survey - bbox {BBOX} (Madeira + Porto Santo + Desertas)")
    for title, (query, labels) in [
        ("Road and path network (T-082, T-064)", NETWORK),
        ("Levadas (T-028, OD-7, T-068)", LEVADAS),
        ("Content candidates (T-066)", CONTENT),
    ]:
        print(f"\n--- {title} ---\n")
        counts = run(query)
        for label, n in zip(labels, counts):
            print(f"{n:>8,}  {label}")
        if len(counts) != len(labels):
            print(f"  !! got {len(counts)} counts, expected {len(labels)}")
