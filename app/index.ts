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

import App from './App';

registerRootComponent(App);
