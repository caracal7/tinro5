import {getContext, hasContext, setContext, tick} from 'svelte';
import {writable, get} from 'svelte/store';

// Код из modes.js
const MODES = {
    HISTORY: 1,
    HASH: 2,
    MEMORY: 3,
    OFF: 4,
    run(mode, fnHistory, fnHash, fnMemory) {
        return mode === this.HISTORY
            ? fnHistory && fnHistory()
            : mode === this.HASH
                ? fnHash && fnHash()
                : fnMemory && fnMemory();
    },
    getDefault() {
        try {
            return window && window.location.pathname === 'srcdoc' ? this.MEMORY : this.HISTORY;
        } catch (e) {
            // В случае ошибки доступа к window (SSR)
            return this.MEMORY;
        }
    }
};

// Необходимые вспомогательные функции из lib.js
export function formatPath(path, slash = false) {
    path = path.slice(
        path.startsWith('/#') ? 2 : 0,
        path.endsWith('/*') ? -2 : undefined
    );
    if (!path.startsWith('/')) path = '/' + path;
    if (path === '/') path = '';
    if (slash && !path.endsWith('/')) path += '/';
    return path;
}

export function getRouteMatch(pattern, path) {
    pattern = formatPath(pattern, true);
    path = formatPath(path, true);

    const keys = [];
    let params = {};
    let exact = true;
    let rx = pattern
       .split('/')
       .map(s => s.startsWith(':') ? (keys.push(s.slice(1)), '([^\\/]+)') : s)
       .join('\\/');

    let match = path.match(new RegExp(`^${rx}$`));
    if (!match) {
        exact = false;
        match = path.match(new RegExp(`^${rx}`));
    }
    if (!match) return null;
    keys.forEach((key, i) => params[key] = match[i + 1]);

    return {
        exact,
        params,
        part: match[0].slice(0, -1)
    };
}

export function getAttr(node, attr, remove, def) {
    const re = [attr, 'data-' + attr].reduce(
        (r, c) => {
            const a = node.getAttribute(c);
            if (remove) node.removeAttribute(c);
            return a === null ? r : a;
        },
    false);
    return !def && re === '' ? true : re ? re : def ? def : false;
}

export function parseQuery(str) {
    const o = str.split('&')
      .map(p => p.split('='))
      .reduce((r, p) => {
          const name = p[0];
          if (!name) return r;
          let value = p.length > 1 ? p[p.length - 1] : true;
          if (typeof value === 'string' && value.includes(',')) value = value.split(',');
          (r[name] === undefined) ? r[name] = [value] : r[name].push(value);
          return r;
      }, {});

    return Object.entries(o).reduce((r, p) => (r[p[0]] = p[1].length > 1 ? p[1] : p[1][0], r), {});
}

export function makeQuery(obj) {
    return Object.entries(obj).map(([name, value]) => {
        if (!value) return null;
        if (value === true) return name;
        return `${name}=${Array.isArray(value) ? value.join(',') : value}`;
    }).filter(e => e).join('&');
}

export function prefix(str, prefix) {
    return !str ? '' : prefix + str;
}


export function makeRedirectURL(path, parent_pattern, slug) {
    if (slug === '') return path;
    if (slug[0] === '/') return slug;
    const getParts = url => url.split('/').filter(p => p !== '');

    const pathParts = getParts(path);
    const patternParts = parent_pattern ? getParts(parent_pattern) : [];

    return '/' + patternParts.map((_, i) => pathParts[i]).join('/') + '/' + slug;
}

// Код из location.js
let memoURL;
let from;
let last;
let base = '';

// Добавляем переменную для отслеживания последнего URL
let lastProcessedUrl = '';

// Добавляем защиту от слишком частых изменений URL
let redirectLock = false;
let redirectTimeout = null;
const REDIRECT_TIMEOUT = 100; // мс между перенаправлениями

// Храним предыдущие данные о местоположении для сравнения
let lastLocationData = null;

// Добавляем дополнительный механизм отслеживания последних перенаправлений
export const recentRedirects = new Set();
export const MAX_RECENT_REDIRECTS = 10;



// Экспортируем для использования в Route.svelte
export { redirectLock };

function createLocation() {
    let MODE = MODES.getDefault();

    let listener;

    const reset = _ => window.onhashchange = window.onpopstate = memoURL = null;
    const dispatch = _ => listener && listener(readLocation(MODE));

    const setMode = newMode => {
        newMode && (MODE = newMode);
        reset();
        MODE !== MODES.OFF
        && MODES.run(MODE,
            _ => window.onpopstate = dispatch,
            _ => window.onhashchange = dispatch
        )
        && dispatch();
    };

    const makeURL = parts => {
        const loc = Object.assign(readLocation(MODE), parts);
        return loc.path
             + prefix(makeQuery(loc.query), '?')
             + prefix(loc.hash, '#');
    };

    return {
        mode: setMode,
        get: _ => readLocation(MODE),
        go(href, replace) {
            // Проверяем, не находимся ли мы уже на этом URL
            const currentLocation = readLocation(MODE);
            if (currentLocation.path === href || currentLocation.url === href) {
                console.log('[Tinro] Already at location:', href);
                return; // Пропускаем переход к текущему URL
            }

            writeLocation(MODE, href, replace);
            dispatch();
        },
        start(fn) {
            listener = fn;
            setMode();
        },
        stop() {
            listener = null;
            setMode(MODES.OFF);
        },
        set(parts) {
            this.go(makeURL(parts), !parts.path);
        },
        methods() { return locationMethods(this); },
        base: newbase => base = newbase
    };
}

function writeLocation(MODE, href, replace) {
    // Пропускаем обработку, если URL не изменился
    if (href === lastProcessedUrl) return;

    // Добавляем защиту от слишком частых изменений
    if (redirectLock) return;
    redirectLock = true;

    // Отменяем предыдущий таймер, если есть
    if (redirectTimeout) clearTimeout(redirectTimeout);

    // Устанавливаем новый таймер
    redirectTimeout = setTimeout(() => {
        redirectLock = false;
    }, REDIRECT_TIMEOUT);

    lastProcessedUrl = href;
    !replace && (from = last);

    const setURL = (url) => history[`${replace ? 'replace' : 'push'}State`]({}, '', url);

    MODES.run(MODE,
        _ => setURL(base + href),
        _ => setURL(`#${href}`),
        _ => memoURL = href
    );
}

function readLocation(MODE) {
    const l = window.location;
    const url = MODES.run(MODE,
        _ => (base ? l.pathname.replace(base, '') : l.pathname) + l.search + l.hash,
        _ => String(l.hash.slice(1) || '/'),
        _ => memoURL || '/'
    );

    // Если URL не изменился, возвращаем сохраненные данные
    if (lastLocationData && lastLocationData.url === url) {
        return lastLocationData;
    }

    const match = url.match(/^([^?#]+)(?:\?([^#]+))?(?:\#(.+))?$/);

    last = url;

    const locationData = {
        url,
        from,
        path: match[1] || '',
        query: parseQuery(match[2] || ''),
        hash: match[3] || '',
    };

    // Сохраняем данные для будущих сравнений
    lastLocationData = locationData;

    return locationData;
}

function locationMethods(l) {
    const getQ = () => l.get().query;
    const setQ = (v) => l.set({query: v});
    const updQ = (fn) => setQ(fn(getQ()));

    const getH = () => l.get().hash;
    const setH = (v) => l.set({hash: v});

    return {
        hash: {
            get: getH,
            set: setH,
            clear: () => setH('')
        },
        query: {
            replace: setQ,
            clear: () => setQ(''),
            get(name) {
                return name ? getQ()[name] : getQ();
            },
            set(name, v) {
                updQ(q => (q[name] = v, q));
            },
            delete(name) {
                updQ(q => ((q[name] && delete q[name]), q));
            }
        }
    };
}

// Создаем и экспортируем location
const location = createLocation();

// Код из router.js
function routerStore() {
    const {subscribe} = writable(location.get(), set => {
        location.start(set);
        let un = aClickListener(location.go);
        return () => {
            location.stop();
            un();
        };
    });

    return {
        subscribe,
        goto: location.go,
        params: getParams, /* DEPRECATED */
        meta: getMeta, /* DEPRECATED */
        useHashNavigation: s => location.mode(s ? MODES.HASH : MODES.HISTORY), /* DEPRECATED */
        mode: {
            hash: () => location.mode(MODES.HASH),
            history: () => location.mode(MODES.HISTORY),
            memory: () => location.mode(MODES.MEMORY),
        },
        base: location.base,
        location: location.methods()
    };
}


// Контекст для route
const CTX = 'tinro';

/* DEPRECATED */
function getParams() {
    return getContext('tinro').meta.params;
}

function getMeta() {
    return hasContext(CTX)
        ? getContext(CTX).meta
        : err('meta() function must be run inside any `<Route>` child component only');
}

export function err(text) {
    throw new Error('[Tinro] ' + text);
}



// Экспортируем router
export const router = routerStore();

window.tinro5 = router;

function active(node) {
    let href;
    let exact;
    let cl;
    let current;
    let unsubscribe;

    const getAttributes = () => {
        href = getAttr(node, 'href').replace(/^\/#|[?#].*$|\/$/g, ''),
        exact = getAttr(node, 'exact', true),
        cl = getAttr(node, 'active-class', true, 'active');
    };

    const matchLink = () => {
        const match = getRouteMatch(href, current);
        match && (match.exact && exact || !exact) ? node.classList.add(cl) : node.classList.remove(cl);
    };

    getAttributes();

    // Используем явное хранение подписки для более надежного управления жизненным циклом
    unsubscribe = router.subscribe(r => {
        current = r?.path || '';
        matchLink();
    });

    return {
        destroy: () => {
            if (unsubscribe) unsubscribe();
        },
        update: () => {
            getAttributes();
            matchLink();
        }
    };
}

window.tinro5.active = active;


function aClickListener(go) {
    const h = e => {
        const a = e.target.closest('a[href]');
        const target = a && getAttr(a, 'target', false, '_self');
        const ignore = a && getAttr(a, 'tinro-ignore');
        const key = e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;

        if (target == '_self' && !ignore && !key && a) {
            const href = a.getAttribute('href').replace(/^\/#/, '');

            if (!/^\/\/|^#|^[a-zA-Z]+:/.test(href)) {
                e.preventDefault();
                go(href.startsWith('/') ? href : a.href.replace(window.location.origin, ''));
            }
        }
    };

    addEventListener('click', h);
    return () => removeEventListener('click', h);
}
