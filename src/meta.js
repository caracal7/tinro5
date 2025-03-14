import { hasContext, getContext } from 'svelte';
import { CTX } from './tinro_internal.js';


export function err(text) {
    throw new Error('[Tinro] ' + text);
}


export function getMeta() {
    return hasContext(CTX)
        ? getContext(CTX).meta
        : err('meta() function must be run inside any `<Route>` child component only');
}
