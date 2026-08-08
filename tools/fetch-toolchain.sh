#!/usr/bin/env bash
# Fetch the tile-build toolchain. Run once on a fresh machine, from the repo root:
#
#     bash tools/fetch-toolchain.sh
#
# Everything lands in tools/jdk/ and tools/bin/, both gitignored. Nothing is
# installed system-wide and nothing is added to PATH — deleting those two
# folders removes the toolchain completely.
#
# Why a portable JDK rather than an installed one: the tile pipeline is the only
# thing in this project that needs Java, and the project lead should not have to
# carry a system-wide Java install for one build step (CONTEXT.md 6.7).
#
# Downloads ~300 MB. The build itself pulls a further ~1.4 GB of global
# reference data on first run — see tiles/pipeline/build.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

JDK_VERSION="21.0.12+8"
JDK_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12%2B8/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12_8.zip"
JDK_SHA256="9ba963ee2371874a74185d18bc7bb2ab9407df7683300855ed7606e0662321d0"

PLANETILER_URL="https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar"
PLANETILER_SHA256="f310bd0413e2e4512b27f4046d418664e8e1d3bf31603c2a70e23de06c167e4d"

PMTILES_VERSION="1.31.2"
PMTILES_URL="https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Windows_x86_64.zip"

mkdir -p tools/bin tools/jdk

# Verify rather than trust. Both upstreams publish checksums; use them.
check() {
  local file="$1" want="$2"
  local got
  got=$(python -c "import hashlib,pathlib,sys; print(hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest())" "$file")
  if [ "$got" != "$want" ]; then
    echo "CHECKSUM MISMATCH for $file" >&2
    echo "  expected $want" >&2
    echo "  got      $got" >&2
    exit 1
  fi
  echo "  verified $file"
}

if [ ! -x "tools/jdk/jdk-${JDK_VERSION}/bin/java.exe" ]; then
  echo "Fetching Temurin JDK ${JDK_VERSION} (196 MB)..."
  curl -L --fail -o tools/jdk/temurin.zip "$JDK_URL"
  check tools/jdk/temurin.zip "$JDK_SHA256"
  (cd tools/jdk && unzip -q -o temurin.zip && rm temurin.zip)
else
  echo "JDK already present, skipping."
fi

if [ ! -f tools/bin/planetiler.jar ]; then
  echo "Fetching planetiler (89 MB)..."
  curl -L --fail -o tools/bin/planetiler.jar "$PLANETILER_URL"
  check tools/bin/planetiler.jar "$PLANETILER_SHA256"
else
  echo "planetiler already present, skipping."
fi

# Not needed by the build. Kept because `pmtiles serve` is how the viewer is
# served locally — PMTiles needs HTTP range requests, which Python's
# http.server does not implement.
if [ ! -f tools/bin/pmtiles.exe ]; then
  echo "Fetching go-pmtiles ${PMTILES_VERSION} (17 MB)..."
  curl -L --fail -o tools/bin/pmtiles.zip "$PMTILES_URL"
  (cd tools/bin && unzip -q -o pmtiles.zip && rm pmtiles.zip)
else
  echo "pmtiles already present, skipping."
fi

echo
echo "Toolchain ready. Next: bash tiles/pipeline/build.sh"
