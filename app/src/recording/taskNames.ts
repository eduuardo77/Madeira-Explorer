/**
 * The names the OS knows our background tasks by.
 *
 * These used to live in `backgroundTasks.ts`, next to the code that defines the
 * tasks. They were moved out to break an import cycle: the geofence task needs
 * the geofence manager (T-039), the manager needs the location provider, and the
 * provider needs these two strings. A cycle through `backgroundTasks.ts` would
 * be the worst possible one to have, because that module's entire job is to run
 * its side effects at startup before anything else touches it.
 *
 * They are also strings the OS remembers across app launches. Changing one after
 * release would orphan whatever the OS is still monitoring under the old name.
 */

export const LOCATION_TASK_NAME = 'madeira-location-updates';
export const GEOFENCE_TASK_NAME = 'madeira-geofencing';
