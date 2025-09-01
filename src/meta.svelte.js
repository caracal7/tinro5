import { writable } from 'svelte/store';

const metaStore = writable({});

let metaState = $state({});

const Meta = {
    subscribe: metaStore.subscribe,
    get: () => {
        let value;
        metaStore.subscribe(v => value = v)();
        return value;
    }
};

export const meta = {
    get current() {
        return metaState
    }
}

Meta.subscribe(newMeta => {
    // metaState = {...newMeta} || {}; // This breaks reactivity by replacing the proxy
    
    // Clear old properties
    for (const key in metaState) {
        delete metaState[key];
    }
    // Assign new properties
    Object.assign(metaState, newMeta);
});

export function updateMeta(newMeta) {
    if (newMeta) {
        metaStore.set(newMeta);
    }
}
