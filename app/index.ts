import { registerRootComponent } from 'expo';

// MUST come before the app renders.
//
// This import has no exported value — it is here purely so that
// `TaskManager.defineTask` runs in the global scope of the bundle. When the OS
// relaunches this app headless to hand us a batch of locations or a geofence
// crossing, it loads the bundle and immediately looks for the task by name. If
// the definition has not run by then, the event is dropped silently.
//
// Expo's own documentation is explicit about this: defineTask "must be called
// in the global scope of your JavaScript bundle".
import './src/recording/backgroundTasks';

import { contentPoiCatalogue } from './src/content/poiCatalogue';
import { withDevFixtureFallback } from './src/recording/devPoiFixture';
import { setPoiCatalogue } from './src/recording/geofenceManager';

import App from './App';

// Module scope, and for the same reason as the import above. When the OS wakes
// us to deliver a geofence crossing, the manager may have to rebuild its
// monitored set (T-039) before it can do anything useful — and it cannot do
// that without knowing which places exist. There is no screen alive at that
// moment to tell it.
//
// This is the single seam between the app and Madeira (D-017): the geofence
// manager knows nothing about the island, and must not learn.
//
// ⚠ The `withDevFixtureFallback` wrapper is development-only scaffolding — it
// substitutes synthetic places while `content/pois.json` is still being curated
// (T-066), and does nothing in a release build. T-117 confirms that.
setPoiCatalogue(withDevFixtureFallback(contentPoiCatalogue));

registerRootComponent(App);
