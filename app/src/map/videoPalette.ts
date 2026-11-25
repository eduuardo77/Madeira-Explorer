/**
 * The exported video's map colours (T-329, D-112): near the Google map the app
 * shows (its pale cyan sea, near-white land, soft greens, gentle relief), laid
 * over the August MapLibre light style (`assets/map/light.json`).
 *
 * August's colours were muted on purpose, to keep the trace first on a map in
 * use (D-026); a video is looked at, not used. Chosen in the sketch
 * (`tools/lib/video-natural-page.html`), which reads this file too.
 *
 * Pure: a style document in, a recoloured copy out.
 */

/** `layer id|paint property` to its value. */
export const VIDEO_PALETTE: Readonly<Record<string, unknown>> = {
  'background|background-color': '#91D8EE',
  'water|fill-color': '#91D8EE',
  'earth|fill-color': '#F3F1EB',
  'landcover|fill-color': [
    'match', ['get', 'kind'],
    'grassland', '#DDEFD3', 'barren', '#EDE8DC', 'urban_area', '#EEECE6', 'farmland', '#E5F0D8',
    'glacier', '#F7F7F5', 'scrub', '#D5EBCB', '#C8E6C0',
  ],
  'landuse_park|fill-color': ['case', ['==', ['get', 'kind'], 'wood'], '#C3E3BA', '#CDE8C4'],
  'landuse_urban_green|fill-color': '#CDE8C4',
  'landuse_beach|fill-color': '#FAF0CF',
  'terrain_hillshade|hillshade-exaggeration': 0.42,
  'terrain_hillshade|hillshade-shadow-color': '#6B7B67',
  'terrain_hillshade|hillshade-accent-color': '#6B7B67',
  'places_locality|text-color': '#404040',
  'places_locality|text-halo-color': '#FFFFFF',
  // The names stand over the trip's roads, which the 3D map drapes under them.
  'places_locality|text-halo-width': 1.6,
};

type Layer = { id: string; paint?: Record<string, unknown> };

/** The style with the video's colours; layers the palette does not name are untouched. */
export function applyVideoPalette<T extends { layers: Layer[] }>(style: T): T {
  const byLayer = new Map<string, Record<string, unknown>>();
  for (const [key, value] of Object.entries(VIDEO_PALETTE)) {
    const [id, property] = key.split('|');
    byLayer.set(id, { ...(byLayer.get(id) ?? {}), [property]: value });
  }
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const paint = byLayer.get(layer.id);
      return paint === undefined ? layer : { ...layer, paint: { ...(layer.paint ?? {}), ...paint } };
    }),
  };
}
