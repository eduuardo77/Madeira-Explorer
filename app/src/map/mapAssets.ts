/**
 * Getting the map's files where the renderer can read them (T-056, T-057).
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * The map is three kinds of file: two PMTiles packs (basemap, terrain) and a
 * directory of font glyphs. They ship inside the app binary (T-057: bundled,
 * not downloaded — at 19 MB the pack is small enough, which D-030 noted
 * reopened that question). But MapLibre Native cannot read them from where
 * they land:
 *
 *   - PMTiles is read by byte range, and Android's bundled-asset reader does
 *     not support range reads. The packs must live on the ordinary
 *     filesystem.
 *   - Glyphs are fetched through a URL template (`.../{fontstack}/{range}`),
 *     which needs a real directory layout to point at.
 *
 * So on first launch this module copies everything once from the bundle into
 * the app's document directory, and hands back `file://` URIs. Subsequent
 * launches verify by size and skip the copy.
 *
 * WHY THE COPY IS VERSION-KEYED
 * -----------------------------
 * An app update can carry a new tile pack. The files are copied into a
 * directory named after the content revision below, so an update with a new
 * revision starts clean, and stale revisions are deleted. Bump the revision
 * whenever any bundled map file changes.
 *
 * Backup note (ARCHITECTURE §4a): everything this module writes is
 * regenerable from the app binary, and the Android backup rules exclude the
 * whole directory by pattern — the tile pack must never crowd the user's
 * trip history out of the backup quota.
 */

import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

/** Bump when any bundled map asset changes. Keep in step with an app release. */
export const MAP_CONTENT_REVISION = 1;

/**
 * Every bundled map file, spelled out one `require` at a time.
 *
 * Metro resolves `require` calls statically at build time, so this cannot be
 * a loop over a directory listing — there is no directory to list at runtime,
 * only assets the bundler was told about individually.
 */
const PACK_MODULES: { name: string; module: number }[] = [
  { name: 'madeira.pmtiles', module: require('../../assets/map/madeira.pmtiles') },
  {
    name: 'madeira-terrain.pmtiles',
    module: require('../../assets/map/madeira-terrain.pmtiles'),
  },
];

const GLYPH_MODULES: { stack: string; range: string; module: number }[] = [
  // prettier-ignore
  { stack: 'Noto Sans Regular', range: '0-255', module: require('../../assets/map/fonts/Noto Sans Regular/0-255.pbf') },
  // prettier-ignore
  { stack: 'Noto Sans Regular', range: '256-511', module: require('../../assets/map/fonts/Noto Sans Regular/256-511.pbf') },
  // prettier-ignore
  { stack: 'Noto Sans Medium', range: '0-255', module: require('../../assets/map/fonts/Noto Sans Medium/0-255.pbf') },
  // prettier-ignore
  { stack: 'Noto Sans Medium', range: '256-511', module: require('../../assets/map/fonts/Noto Sans Medium/256-511.pbf') },
  // prettier-ignore
  { stack: 'Noto Sans Italic', range: '0-255', module: require('../../assets/map/fonts/Noto Sans Italic/0-255.pbf') },
  // prettier-ignore
  { stack: 'Noto Sans Italic', range: '256-511', module: require('../../assets/map/fonts/Noto Sans Italic/256-511.pbf') },
];

export type MapAssetUris = {
  /** `pmtiles://file://...` — ready to substitute into the style template. */
  tilesUrl: string;
  terrainUrl: string;
  /** `file://.../fonts` — the glyph template root, no trailing slash. */
  glyphsRoot: string;
};

let prepared: MapAssetUris | null = null;

/**
 * Copy one bundled asset to `destination` unless an identical-size copy is
 * already there. Size is a cheap integrity check, not a strong one — the
 * revision directory is what actually guarantees freshness across updates.
 */
async function ensureCopied(module: number, destination: File): Promise<void> {
  const asset = Asset.fromModule(module);
  // In a development build the "bundled" asset may actually live on the Metro
  // server; downloadAsync guarantees a local file either way. In a release
  // build it resolves to the file inside the binary without copying.
  await asset.downloadAsync();
  if (asset.localUri === null) {
    throw new Error(`asset ${asset.name} has no local file after download`);
  }

  const source = new File(asset.localUri);
  if (destination.exists && destination.size === source.size) {
    return;
  }
  source.copy(destination);
}

/**
 * Make every map file readable by the renderer, and return the URIs.
 *
 * Idempotent and safe to call from anywhere that is about to show a map; the
 * work happens once per content revision, and once per process at most.
 */
export async function prepareMapAssets(): Promise<MapAssetUris> {
  if (prepared !== null) {
    return prepared;
  }

  const mapRoot = new Directory(Paths.document, 'map');
  const revisionDir = new Directory(mapRoot, `v${MAP_CONTENT_REVISION}`);

  // A previous revision's files are dead weight the moment this one exists;
  // delete rather than strand 19 MB on the user's phone.
  if (mapRoot.exists) {
    for (const entry of mapRoot.list()) {
      if (entry instanceof Directory && entry.name !== `v${MAP_CONTENT_REVISION}`) {
        entry.delete();
      }
    }
  }
  revisionDir.create({ intermediates: true, idempotent: true });

  for (const pack of PACK_MODULES) {
    await ensureCopied(pack.module, new File(revisionDir, pack.name));
  }

  const fontsDir = new Directory(revisionDir, 'fonts');
  for (const glyph of GLYPH_MODULES) {
    const stackDir = new Directory(fontsDir, glyph.stack);
    stackDir.create({ intermediates: true, idempotent: true });
    await ensureCopied(
      glyph.module,
      new File(stackDir, `${glyph.range}.pbf`)
    );
  }

  prepared = {
    // MapLibre Native wants the inner URL fully specified: pmtiles://file://…
    tilesUrl: `pmtiles://${new File(revisionDir, 'madeira.pmtiles').uri}`,
    terrainUrl: `pmtiles://${new File(revisionDir, 'madeira-terrain.pmtiles').uri}`,
    glyphsRoot: fontsDir.uri,
  };
  return prepared;
}
