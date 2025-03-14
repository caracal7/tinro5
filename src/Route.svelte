<script>
    import {getContext, setContext, onMount, tick, onDestroy} from 'svelte';
    import {writable} from 'svelte/store';
    import {
        router,
        formatPath,
        getRouteMatch,
        makeRedirectURL
    } from './tinro_internal.js';


    // Контекст для route
    const CTX = 'tinro';

    // Перемещаем механизм предотвращения редиректов в компонент
    const recentRedirects = new Set();
    const MAX_RECENT_REDIRECTS = 10;
    let redirectLock = false;
    let redirectTimeout = null;
    const REDIRECT_TIMEOUT = 100; // мс между перенаправлениями

    // ROOT для createRouteObject
    const ROOT = createRouteProtoObject({
        pattern: '',
        matched: true
    });

    function createRouteProtoObject(options) {
        const proto = {
            router: {},
            exact: false,
            pattern: null,
            meta: null,
            parent: null,
            fallback: false,
            redirect: false,
            firstmatch: false,
            breadcrumb: null,
            matched: false,
            childs: new Set(),
            activeChilds: new Set(),
            fallbacks: new Set(),
            async showFallbacks() {
                if (this.fallback) return;

                if (this._processingFallbacks) return;
                this._processingFallbacks = true;

                await tick();

                if (
                    (this.childs.size > 0 && this.activeChilds.size == 0) ||
                    (this.childs.size == 0 && this.fallbacks.size > 0)
                ) {
                    let obj = this;
                    while (obj.fallbacks.size == 0) {
                        obj = obj.parent;
                        if (!obj) {
                            this._processingFallbacks = false;
                            return;
                        }
                    }

                    let redirected = false;

                    obj && obj.fallbacks.forEach(fb => {
                        if (fb.redirect && !redirected && !redirectLock) {
                            redirected = true;
                            const nextUrl = makeRedirectURL('/', fb.parent.pattern, fb.redirect);

                            // Проверяем, не был ли этот редирект уже недавно выполнен
                            if (recentRedirects.has(nextUrl)) {
                                console.warn('[Tinro] Detected redirect loop in fallback:', nextUrl);
                                return;
                            }

                            // Добавляем текущий редирект в список недавних
                            recentRedirects.add(nextUrl);
                            if (recentRedirects.size > MAX_RECENT_REDIRECTS) {
                                // Удаляем самый старый редирект
                                recentRedirects.delete(recentRedirects.values().next().value);
                            }

                            // Защита от слишком частых изменений URL
                            redirectLock = true;

                            // Отменяем предыдущий таймер, если есть
                            if (redirectTimeout) clearTimeout(redirectTimeout);

                            // Устанавливаем новый таймер
                            redirectTimeout = setTimeout(() => {
                                redirectLock = false;
                            }, REDIRECT_TIMEOUT);

                            router.goto(nextUrl, true);
                        } else if (!fb.redirect) {
                            fb.show();
                        }
                    });
                }

                this._processingFallbacks = false;
            },
            start() {
                if (this.router.un) return;
                this.router.un = router.subscribe(r => {
                    this.router.location = r;
                    if (this.pattern !== null) this.match();
                });
            },
            match() { this.showFallbacks(); }
        };

        Object.assign(proto, options);
        proto.start();

        return proto;
    }

    function createRouteObject(options, parent) {
        parent = parent || getContext(CTX) || ROOT;

        if (parent.exact || parent.fallback)  {
            throw new Error(`${options.fallback ? '<Route fallback>' : `<Route path="${options.path}">`}  can't be inside ${parent.fallback ?
                '<Route fallback>' :
                `<Route path="${parent.path || '/'}"> with exact path`}`);
        }

        const type = options.fallback ? 'fallbacks' : 'childs';

        const metaStore = writable({});

        // Флаг для предотвращения рекурсивных вызовов
        let matching = false;

        const route = createRouteProtoObject({
            fallback: options.fallback,
            parent,
            update(opts) {
                route.exact = !opts.path.endsWith('/*');
                route.pattern = formatPath(`${route.parent.pattern || ''}${opts.path}`);
                route.redirect = opts.redirect;
                route.firstmatch = opts.firstmatch;
                route.breadcrumb = opts.breadcrumb;
                route.match();
            },
            register: () => {
                route.parent[type].add(route);
                return async () => {
                    route.parent[type].delete(route);
                    route.parent.activeChilds.delete(route);
                    route.router.un && route.router.un();
                    route.parent.match();
                };
            },
            show: () => {
                options.onShow();
                !route.fallback && route.parent.activeChilds.add(route);
            },
            hide: () => {
                options.onHide();
                route.parent.activeChilds.delete(route);
            },
            match: async () => {
                // Предотвращаем рекурсивные вызовы
                if (matching) return;
                matching = true;

                route.matched = false;

                const {path, url, from, query} = route.router.location;
                const match = getRouteMatch(route.pattern, path);

                if (!route.fallback && match && route.redirect && (!route.exact || (route.exact && match.exact))) {
                    const nextUrl = makeRedirectURL(path, route.parent.pattern, route.redirect);

                    // Проверяем, не был ли этот редирект уже недавно выполнен
                    if (recentRedirects.has(nextUrl)) {
                        console.warn('[Tinro] Detected redirect loop:', nextUrl);
                        matching = false;
                        return;
                    }

                    // Добавляем текущий редирект в список недавних
                    recentRedirects.add(nextUrl);
                    if (recentRedirects.size > MAX_RECENT_REDIRECTS) {
                        // Удаляем самый старый редирект
                        recentRedirects.delete(recentRedirects.values().next().value);
                    }

                    // Защита от слишком частых изменений URL
                    redirectLock = true;

                    // Отменяем предыдущий таймер, если есть
                    if (redirectTimeout) clearTimeout(redirectTimeout);

                    // Устанавливаем новый таймер
                    redirectTimeout = setTimeout(() => {
                        redirectLock = false;
                    }, REDIRECT_TIMEOUT);

                    matching = false;
                    return router.goto(nextUrl, true);
                }

                route.meta = match && {
                    from,
                    url,
                    query,
                    match: match.part,
                    pattern: route.pattern,
                    breadcrumbs: route.parent.meta && route.parent.meta.breadcrumbs.slice() || [],
                    params: match.params,
                    subscribe: metaStore.subscribe
                };

                route.breadcrumb && route.meta && route.meta.breadcrumbs.push({
                    name: route.breadcrumb,
                    path: match.part
                });

                metaStore.set(route.meta);

                if (
                    match
                    && !route.fallback
                    && (!route.exact || (route.exact && match.exact))
                    && (!route.parent.firstmatch || !route.parent.matched)
                ) {
                    options.onMeta(route.meta);
                    route.parent.matched = true;
                    route.show();
                } else {
                    route.hide();
                }

                if (match) await route.showFallbacks();

                matching = false;
            }
        });

        // Важно! Устанавливаем контекст для корректной работы meta()
        setContext(CTX, route);

        return route;
    }

    export let path = '/*';
    export let fallback = false;
    export let redirect = false;
    export let firstmatch = false;
    export let breadcrumb = null;
    export let meta = undefined;
    export let children;

    let showContent = false;
    let _meta = {};
    let _meta2 = {};

    const route = createRouteObject({
        fallback,
        onShow() {
            if (showContent === true) return;
            showContent = true;
            _meta2 = _meta;
        },
        onHide(...args) {
            if (showContent === false) return;
            showContent = false;
        },
        onMeta(newmeta) {
            _meta = newmeta;
        }
    });

    // Отдельные функции для управления жизненным циклом
    let unregister;

    // Регистрируем маршрут при монтировании
    onMount(() => {
        unregister = route.register();
    });

    // Используем onDestroy для корректной очистки ресурсов
    onDestroy(() => {
        if (unregister) unregister();
        if (redirectTimeout) {
            clearTimeout(redirectTimeout);
            redirectTimeout = null;
        }
    });

    // Реактивное обновление параметров маршрута
    $: route.update({
        path,
        redirect,
        firstmatch,
        breadcrumb,
    });
</script>

{#if showContent}
    {#if meta}
        {@render meta(_meta2)}
    {:else}
        {@render children?.()}
    {/if}
{/if}
