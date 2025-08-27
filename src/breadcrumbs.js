import { writable } from 'svelte/store';

// Создаем глобальный store для breadcrumbs
const breadcrumbsStore = writable([]);

// Экспортируем глобальный объект breadcrumbs
export const breadcrumbs = {
    subscribe: breadcrumbsStore.subscribe,
    get: () => {
        let value;
        breadcrumbsStore.subscribe(v => value = v)();
        return value;
    }
};

// Функция для внутреннего использования в Route компоненте
export function updateRouteBreadcrumbs(routeMeta) {
    if (routeMeta && routeMeta.breadcrumbs) {
        breadcrumbsStore.set(routeMeta.breadcrumbs);
    }
}
