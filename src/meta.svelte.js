import { writable } from 'svelte/store';

const metaStore = writable({
    from: undefined,
    url: undefined,
    query: undefined,
    match: undefined,
    pattern: undefined,
    breadcrumbs: undefined,
    params: undefined,
    subscribe: undefined
});

let metaState = $state({
    from: undefined,
    url: undefined,
    query: undefined,
    match: undefined,
    pattern: undefined,
    breadcrumbs: undefined,
    params: undefined,
    subscribe: undefined
});

const Meta = {
    subscribe: metaStore.subscribe,
    get: () => {
        let value;
        metaStore.subscribe(v => value = v)();
        return value;
    }
};

Meta.subscribe(newMeta => {
    for (const key in metaState) {
        delete metaState[key];
    }
    Object.assign(metaState, newMeta);
});


const initialState = {
    from: undefined,
    url: undefined,
    query: undefined,
    match: undefined,
    pattern: undefined,
    breadcrumbs: undefined,
    params: undefined,
    subscribe: undefined
};

let pendingMeta = undefined;
let updateScheduled = false;

const applyMetaUpdate = () => {
    updateScheduled = false;
    if (pendingMeta !== undefined) {
        const currentMeta = Meta.get();
        const newMeta = pendingMeta || initialState;
        if(JSON.stringify(currentMeta) !== JSON.stringify(newMeta)) {
            metaStore.set(newMeta);
        }
    }
    pendingMeta = undefined;
};

export function updateMeta(newMeta) {
    if (pendingMeta && !newMeta) {
        return;
    }
    pendingMeta = newMeta;

    if (!updateScheduled) {
        updateScheduled = true;
        Promise.resolve().then(applyMetaUpdate);
    }
}

export const meta = new Proxy(metaState, {
    get(target, prop) {
        return target[prop];
    },
    set() {
        throw new Error('[Tinro] reactive_meta is read-only');
    }
});
