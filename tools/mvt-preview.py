"""Render vector tiles to a static SVG - no browser, no GPU, no style engine.

    python tools/mvt-preview.py --pack madeira-protomaps --z 10 --out preview.svg

Why: the question "how good will the map look" should be answered by looking at
the real geometry, not by comparing schema tables. This stitches a grid of tiles
straight from the pmtiles server and draws them, so the coastline, roads and
levadas on screen are the actual data the app would ship.

It is NOT a cartography engine and is not trying to be pretty - it is a truth
check on what is in the pack. The real styling work is T-058, in MapLibre.

Extends the protobuf reader in mvt-inspect.py with geometry decoding: MVT packs
geometry as command integers ((id & 0x7) | (count << 3)) followed by zigzag
parameter pairs, with coordinates relative to the previous point.
"""
import argparse
import gzip
import math
import urllib.request

from importlib.machinery import SourceFileLoader
from pathlib import Path

_mvt = SourceFileLoader("mvt", str(Path(__file__).with_name("mvt-inspect.py"))).load_module()
fields, varint = _mvt.fields, _mvt.varint


def zigzag(n):
    return (n >> 1) ^ (-(n & 1))


def decode_geometry(buf):
    """Return a list of rings/lines, each a list of (x, y) in tile units."""
    out, cur, x, y, i = [], [], 0, 0, 0
    while i < len(buf):
        cmd_int, i = varint(buf, i)
        cmd, count = cmd_int & 0x7, cmd_int >> 3
        if cmd == 7:                              # ClosePath
            if cur:
                cur.append(cur[0])
            continue
        for _ in range(count):
            dx, i = varint(buf, i)
            dy, i = varint(buf, i)
            x += zigzag(dx)
            y += zigzag(dy)
            if cmd == 1:                          # MoveTo starts a new part
                if cur:
                    out.append(cur)
                cur = [(x, y)]
            else:                                 # LineTo
                cur.append((x, y))
    if cur:
        out.append(cur)
    return out


def parse_tile(raw):
    """Yield (layer_name, props, geom_type, parts)."""
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    for fnum, wtype, payload in fields(raw):
        if fnum != 3 or wtype != 2:
            continue
        name, keys, values, extent = None, [], [], 4096
        raw_feats = []
        for lfn, lwt, lpl in fields(payload):
            if lfn == 1:
                name = lpl.decode("utf-8", "replace")
            elif lfn == 2:
                tags, gtype, geom = [], None, b""
                for ffn, fwt, fpl in fields(lpl):
                    if ffn == 2:
                        j, t = 0, []
                        while j < len(fpl):
                            v, j = varint(fpl, j)
                            t.append(v)
                        tags = t
                    elif ffn == 3:
                        gtype = fpl
                    elif ffn == 4:
                        geom = fpl
                raw_feats.append((tags, gtype, geom))
            elif lfn == 3:
                keys.append(lpl.decode("utf-8", "replace"))
            elif lfn == 4:
                values.append(_mvt.parse_value(lpl))
            elif lfn == 5:
                extent = lpl
        for tags, gtype, geom in raw_feats:
            props = {}
            for k, v in zip(tags[0::2], tags[1::2]):
                if k < len(keys) and v < len(values):
                    props[keys[k]] = values[v]
            yield name, props, gtype, decode_geometry(geom), extent


# Deliberately flat and quiet. Roads are one weight; the point is to see what
# geometry exists, not to pre-empt T-058.
STYLE = {
    # Protomaps
    "earth":      dict(fill="#e9e5dd", stroke="none", z=1),
    "landuse":    dict(fill="#dfe3d3", stroke="none", z=2, opacity=0.75),
    "water":      dict(fill="#b9cdd8", stroke="#b9cdd8", width=0.6, z=3),
    "roads":      dict(fill="none", stroke="#ffffff", width=0.9, z=5),
    # OpenMapTiles
    "landcover":     dict(fill="#dfe3d3", stroke="none", z=2, opacity=0.75),
    "park":          dict(fill="#dbe4d2", stroke="none", z=2, opacity=0.5),
    "transportation": dict(fill="none", stroke="#ffffff", width=0.9, z=5),
    "waterway":      dict(fill="none", stroke="#7fb0c8", width=0.5, z=4),
}
LEVADA = dict(fill="none", stroke="#e01b6a", width=1.4, z=9)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack", default="madeira-protomaps")
    ap.add_argument("--server", default="http://localhost:8090")
    ap.add_argument("--z", type=int, default=10)
    ap.add_argument("--bbox", default="-17.30,32.60,-16.60,32.92",
                    help="west,south,east,north")
    ap.add_argument("--size", type=int, default=1600)
    ap.add_argument("--out", default="preview.svg")
    a = ap.parse_args()

    w, s, e, n = map(float, a.bbox.split(","))
    N = 2 ** a.z

    def tx(lon):
        return (lon + 180) / 360 * N

    def ty(lat):
        r = math.radians(lat)
        return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * N

    x0, x1 = int(tx(w)), int(tx(e))
    y0, y1 = int(ty(n)), int(ty(s))
    px0, px1, py0, py1 = tx(w), tx(e), ty(n), ty(s)
    scale = a.size / (px1 - px0)
    height = int((py1 - py0) * scale)

    items, levadas, count = [], [], 0
    for X in range(x0, x1 + 1):
        for Y in range(y0, y1 + 1):
            url = f"{a.server}/{a.pack}/{a.z}/{X}/{Y}.mvt"
            try:
                raw = urllib.request.urlopen(url, timeout=30).read()
            except Exception:
                continue
            if not raw:
                continue
            count += 1
            for layer, props, gtype, parts, extent in parse_tile(raw):
                st = STYLE.get(layer)
                name = str(props.get("name", ""))
                is_lev = "levada" in name.lower()
                if not st and not is_lev:
                    continue
                d = []
                for part in parts:
                    pts = []
                    for (gx, gy) in part:
                        lx = (X + gx / extent - px0) * scale
                        ly = (Y + gy / extent - py0) * scale
                        pts.append(f"{lx:.1f},{ly:.1f}")
                    if len(pts) > 1:
                        d.append("M" + "L".join(pts))
                if not d:
                    continue
                path = " ".join(d)
                (levadas if is_lev else items).append(
                    ((LEVADA if is_lev else st)["z"], path, LEVADA if is_lev else st, gtype))

    body = []
    for z, path, st, gtype in sorted(items + levadas, key=lambda t: t[0]):
        fill = st.get("fill", "none")
        if gtype != 3:
            fill = "none"
        body.append(
            f'<path d="{path}" fill="{fill}" stroke="{st.get("stroke","none")}" '
            f'stroke-width="{st.get("width",0)}" stroke-linejoin="round" '
            f'stroke-linecap="round" opacity="{st.get("opacity",1)}"/>')

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{a.size}" height="{height}" '
           f'viewBox="0 0 {a.size} {height}">'
           f'<rect width="100%" height="100%" fill="#cfe0e8"/>' + "".join(body) + "</svg>")
    Path(a.out).write_text(svg, encoding="utf-8")
    print(f"{a.out}  {len(svg)//1024} KB  from {count} tiles  "
          f"({len(items)} features, {len(levadas)} levada)")


if __name__ == "__main__":
    main()
