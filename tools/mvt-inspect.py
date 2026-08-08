"""Inspect a Mapbox Vector Tile without a browser or any dependency.

    python tools/mvt-inspect.py <tile.mvt> [--layer waterway] [--grep Levada]

Why this exists: the browser is a poor place to answer "did this tag survive
into the tiles". It needs a visible window, a working style, and a GPU. This
reads the protobuf directly, so it answers schema questions in one command and
works in CI later.

Implements just enough of the MVT spec (a protobuf) to read layer names, keys
and string values - no geometry decoding, which is where the complexity is.
No third-party packages, in keeping with the zero-dependency target (CONTEXT
6.4) - though that rule is about the *app*, this simply did not need one.
"""
import gzip
import sys
from collections import Counter


def varint(buf, i):
    """Protobuf base-128 varint. Returns (value, next_index)."""
    result = shift = 0
    while True:
        b = buf[i]
        i += 1
        result |= (b & 0x7F) << shift
        if not b & 0x80:
            return result, i
        shift += 7


def fields(buf, start=0, end=None):
    """Yield (field_number, wire_type, payload_or_value) for one message."""
    i, end = start, len(buf) if end is None else end
    while i < end:
        key, i = varint(buf, i)
        fnum, wtype = key >> 3, key & 7
        if wtype == 0:                       # varint
            val, i = varint(buf, i)
            yield fnum, wtype, val
        elif wtype == 2:                     # length-delimited
            ln, i = varint(buf, i)
            yield fnum, wtype, buf[i:i + ln]
            i += ln
        elif wtype == 5:                     # 32-bit
            yield fnum, wtype, buf[i:i + 4]
            i += 4
        elif wtype == 1:                     # 64-bit
            yield fnum, wtype, buf[i:i + 8]
            i += 8
        else:
            raise ValueError(f"bad wire type {wtype}")


def parse_value(buf):
    """MVT Value: only the string case matters for schema inspection."""
    for fnum, wtype, payload in fields(buf):
        if fnum == 1 and wtype == 2:
            return payload.decode("utf-8", "replace")
        if fnum in (4, 5, 6) and wtype == 0:
            return payload
        if fnum == 7 and wtype == 0:
            return bool(payload)
    return None


def parse_layer(buf):
    name, keys, values, features, extent = None, [], [], [], 4096
    for fnum, wtype, payload in fields(buf):
        if fnum == 1 and wtype == 2:
            name = payload.decode("utf-8", "replace")
        elif fnum == 2 and wtype == 2:
            tags, gtype = [], None
            for ffn, fwt, fpl in fields(payload):
                if ffn == 2 and fwt == 2:
                    j, t = 0, []
                    while j < len(fpl):
                        v, j = varint(fpl, j)
                        t.append(v)
                    tags = t
                elif ffn == 3 and fwt == 0:
                    gtype = fpl
            features.append((tags, gtype))
        elif fnum == 3 and wtype == 2:
            keys.append(payload.decode("utf-8", "replace"))
        elif fnum == 4 and wtype == 2:
            values.append(parse_value(payload))
        elif fnum == 5 and wtype == 0:
            extent = payload
    return name, keys, values, features, extent


def main():
    # Madeira place names are full of diacritics (Caldeirao, Joao, Sao) and the
    # Windows console defaults to cp1252, which mangles them into noise. The
    # tile data is UTF-8 and fine; only the printing was wrong.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = sys.argv[1]
    want_layer = None
    grep = None
    if "--layer" in sys.argv:
        want_layer = sys.argv[sys.argv.index("--layer") + 1]
    if "--grep" in sys.argv:
        grep = sys.argv[sys.argv.index("--grep") + 1].lower()

    raw = open(path, "rb").read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)

    GEOM = {1: "point", 2: "line", 3: "polygon"}
    for fnum, wtype, payload in fields(raw):
        if fnum != 3 or wtype != 2:
            continue
        name, keys, values, features, extent = parse_layer(payload)
        if want_layer and name != want_layer:
            continue

        print(f"\nlayer {name!r}  features={len(features)}  extent={extent}")

        classes, geoms, matches = Counter(), Counter(), []
        for tags, gtype in features:
            geoms[GEOM.get(gtype, gtype)] += 1
            props = {}
            for k, v in zip(tags[0::2], tags[1::2]):
                if k < len(keys) and v < len(values):
                    props[keys[k]] = values[v]
            if "class" in props:
                classes[str(props["class"])] += 1
            nm = str(props.get("name", ""))
            if grep and grep in nm.lower():
                matches.append((nm, props.get("class"), GEOM.get(gtype, gtype)))

        if classes:
            print("  by class:", dict(classes.most_common()))
        print("  by geometry:", dict(geoms))
        if grep:
            print(f"  name contains {grep!r}: {len(matches)}")
            seen = set()
            for nm, cls, g in matches:
                if nm in seen:
                    continue
                seen.add(nm)
                print(f"    {nm}   class={cls}  {g}")
                if len(seen) >= 12:
                    print("    ...")
                    break


if __name__ == "__main__":
    main()
