// Metro bundler configuration.
//
// It exists for exactly one reason: `content/` lives outside `app/`, and a
// bundler will not look outside its own project root unless it is told to.
// That layout is deliberate — README's `content/` rule and D-017 keep every
// piece of Madeira knowledge out of the application source, so that a second
// island would be a content pack rather than a rewrite.
//
// `app/src/content/poiCatalogue.ts` imports `../../../content/pois.json`. The
// watchFolders entry below is what makes that import resolve, and what makes
// Metro notice when the file changes during development.

const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repositoryRoot = path.resolve(projectRoot, '..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(repositoryRoot, 'content')];

// The map ships as files, not code (T-056): two PMTiles packs and the glyph
// PBFs under assets/map/. Metro only treats listed extensions as assets —
// without these lines the `require('../assets/map/madeira.pmtiles')` in
// mapAssets.ts would be a resolution error.
config.resolver.assetExts.push('pmtiles', 'pbf');

module.exports = config;
