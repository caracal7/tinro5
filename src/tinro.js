import { router, active } from './router.js';
import { createRouteObject, getMeta } from './route.js';
import { breadcrumbs } from './breadcrumbs.svelte.js';
import { meta as reactive_meta } from './meta.svelte.js';

export { router, active, getMeta as meta, reactive_meta, createRouteObject, breadcrumbs };
