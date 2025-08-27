import { writable } from 'svelte/store';


const breadcrumbsStore = writable([]);

let breadcrumbsState = $state([]);


const Breadcrumbs = {
    subscribe: breadcrumbsStore.subscribe,
    get: () => {
        let value;
        breadcrumbsStore.subscribe(v => value = v)();
        return value;
    }
};


export const breadcrumbs = {
    get breadcrumbs() {
        return breadcrumbsState
    }
}


Breadcrumbs.subscribe(items => {
    breadcrumbsState = [...items] || [];
});


// Функция для внутреннего использования в Route компоненте
export function updateRouteBreadcrumbs(routeMeta) {
    if (routeMeta && routeMeta.breadcrumbs) {
        breadcrumbsStore.set(routeMeta.breadcrumbs);
    }
}


