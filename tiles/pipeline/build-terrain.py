"""T-058a - build the offline elevation pack for shaded terrain (D-026).

    python tiles/pipeline/build-terrain.py

Output: tiles/out/madeira-terrain.pmtiles  (gitignored - regenerate, never commit)

WHAT THIS IS
------------
Not an image of hillshading. It is raw elevation, as "terrarium" PNG tiles,
where each pixel's RGB encodes height in metres. MapLibre's `hillshade` layer
turns that into shaded relief on the GPU at render time, which is why one
elevation pack serves both the light and dark styles (D-026) - each style
shades the same mountains its own way.

SOURCE
------
The AWS Open Data "Terrain Tiles" set (s3://elevation-tiles-prod, public, no
key). For Madeira the underlying DEM is NASA SRTM (public domain); the tile
set itself asks for a courtesy credit to Mapzen/its DEM sources, carried in
the source attribution below. Like the basemap (build.sh), this is a
BUILD-time fetch: we ship the file, the app never makes a network request
(D-001). If the bucket disappears, the pack we built keeps working.

ZOOM CEILING
------------
z12. The DEM under it is ~30 m per pixel, which z12 already slightly
outresolves; deeper zooms would quadruple the tile count to interpolate the
same data. MapLibre overzooms the DEM automatically when the camera goes
past z12, so shading never disappears - ridges just stop gaining new detail.
"""

import io
import sqlite3
import struct
import subprocess
import sys
import time
import urllib.request
from math import asinh, cos, floor, pi, radians, tan
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "tiles" / "out"
MBTILES = OUT_DIR / "madeira-terrain.mbtiles"
PMTILES = OUT_DIR / "madeira-terrain.pmtiles"
PMTILES_CLI = ROOT / "tools" / "bin" / "pmtiles.exe"

# Same bbox as build.sh - both islands plus the Desertas (D-021).
WEST, SOUTH, EAST, NORTH = -17.32, 32.40, -16.20, 33.20
MAX_ZOOM = 12

URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

ATTRIBUTION = (
    "Elevation: Terrain Tiles (Mapzen/AWS Open Data); DEM: NASA SRTM"
)


def tile_range(zoom: int):
    """Slippy-map tile x/y ranges covering the bbox at one zoom level."""
    n = 2**zoom

    def x_of(lon):
        return floor((lon + 180.0) / 360.0 * n)

    def y_of(lat):
        # Web Mercator row; y grows southward, hence NORTH gives the low row.
        return floor((1.0 - asinh(tan(radians(lat))) / pi) / 2.0 * n)

    return (
        range(x_of(WEST), x_of(EAST) + 1),
        range(y_of(NORTH), y_of(SOUTH) + 1),
    )


def fetch(url: str, attempts: int = 3) -> bytes:
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                return response.read()
        except Exception:
            if attempt == attempts:
                raise
            time.sleep(2 * attempt)
    raise AssertionError("unreachable")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if MBTILES.exists():
        MBTILES.unlink()

    db = sqlite3.connect(MBTILES)
    db.executescript(
        """
        CREATE TABLE metadata (name TEXT, value TEXT);
        CREATE TABLE tiles (
          zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER,
          tile_data BLOB
        );
        CREATE UNIQUE INDEX tile_index
          ON tiles (zoom_level, tile_column, tile_row);
        """
    )
    db.executemany(
        "INSERT INTO metadata (name, value) VALUES (?, ?);",
        [
            ("name", "madeira-terrain"),
            ("format", "png"),
            # MBTiles has no standard slot for the DEM encoding; consumers are
            # told it is terrarium by the style's source definition.
            ("description", "Terrarium elevation tiles for the Madeira bbox"),
            ("minzoom", "0"),
            ("maxzoom", str(MAX_ZOOM)),
            ("bounds", f"{WEST},{SOUTH},{EAST},{NORTH}"),
            ("attribution", ATTRIBUTION),
        ],
    )

    total = 0
    total_bytes = 0
    for zoom in range(0, MAX_ZOOM + 1):
        xs, ys = tile_range(zoom)
        for x in xs:
            for y in ys:
                data = fetch(URL.format(z=zoom, x=x, y=y))
                # MBTiles stores rows in TMS order (flipped vs slippy y).
                tms_y = (2**zoom - 1) - y
                db.execute(
                    "INSERT INTO tiles VALUES (?, ?, ?, ?);",
                    (zoom, x, tms_y, data),
                )
                total += 1
                total_bytes += len(data)
        db.commit()
        print(f"z{zoom:>2}: done ({total} tiles, {total_bytes / 1e6:.1f} MB)")

    db.close()

    subprocess.run(
        [str(PMTILES_CLI), "convert", str(MBTILES), str(PMTILES)], check=True
    )
    MBTILES.unlink()

    size = PMTILES.stat().st_size
    print(f"\n{PMTILES.name}: {size / 1e6:.1f} MB, {total} tiles")
    print("Record this against T-026 - terrain was the known missing cost.")


if __name__ == "__main__":
    sys.exit(main())
