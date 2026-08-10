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

import { devPoiCatalogue } from './src/recording/devPoiFixture';
import { setPoiCatalogue } from './src/recording/geofenceManager';

import App from './App';

// Module scope, and for the same reason as the import above. When the OS wakes
// us to deliver a geofence crossing, the manager may have to rebuild its
// monitored set (T-039) before it can do anything useful — and it cannot do
// that without knowing which places exist. There is no screen alive at that
// moment to tell it.
//
// ⚠ T-040 REPLACES THIS LINE (and its import) with the real content pack. That
// is the whole of the change: the geofence manager itself knows nothing about
// Madeira, and must not learn (D-017).
setPoiCatalogue(devPoiCatalogue);

registerRootComponent(App);
