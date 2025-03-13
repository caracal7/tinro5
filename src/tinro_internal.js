import {getContext, hasContext, setContext, tick} from 'svelte';
import {writable} from 'svelte/store';

// Код из modes.js
export const MODES = {
    HISTORY: 1,
    HASH: 2,
    MEMORY: 3,
    OFF: 4,
    run(mode, fnHistory, fnHash, fnMemory) {
        return mode === MODES.HISTORY 
            ? fnHistory && fnHistory()
            : mode === MODES.HASH
                ? fnHash && fnHash()
                : fnMemory && fnMemory();
    },
    getDefault() {
        return !window || window.location.pathname === 'srcdoc' ? MODES.MEMORY : MODES.HISTORY;
    }
};

// Вспомогательные функции из lib.js
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

export function makeRedirectURL(path, parent_pattern, slug) {
    if (slug === '') return path;
    if (slug[0] === '/') return slug;
    const getParts = url => url.split('/').filter(p => p !== '');

    const pathParts = getParts(path);
    const patternParts = parent_pattern ? getParts(parent_pattern) : [];

    return '/' + patternParts.map((_, i) => pathParts[i]).join('/') + '/' + slug;
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

export function err(text) {
    throw new Error('[Tinro] ' + text);
}

// Код из location.js
let memoURL;
let from;
let last;
let base = '';

// Добавляем переменную для отслеживания последнего URL
let lastProcessedUrl = '';

const location = createLocation();

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

    const match = url.match(/^([^?#]+)(?:\?([^#]+))?(?:\#(.+))?$/);

    last = url;

    return {
        url,
        from,
        path: match[1] || '',
        query: parseQuery(match[2] || ''),
        hash: match[3] || '',
    };
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

export const router = routerStore();

export function active(node) {
    let href;
    let exact;
    let cl;
    let current;

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
          
    return {
        destroy: router.subscribe(r => {current = r.path; matchLink();}),
        update: () => { getAttributes(); matchLink();}
    };
}

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

/* DEPRECATED */
function getParams() {
    return getContext('tinro').meta.params;
}

// Код из route.js
const CTX = 'tinro';

export function createRouteObject(options, parent) {
    parent = parent || getContext(CTX) || ROOT;

    if (parent.exact || parent.fallback)  err(
        `${options.fallback ? '<Route fallback>' : `<Route path="${options.path}">`}  can't be inside ${parent.fallback ?
            '<Route fallback>' :
            `<Route path="${parent.path || '/'}"> with exact path` }`
    );

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

export function getMeta() {
    return hasContext(CTX)
        ? getContext(CTX).meta
        : err('meta() function must be run inside any `<Route>` child component only');
}

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
                    if (fb.redirect && !redirected) {
                        redirected = true;
                        const nextUrl = makeRedirectURL('/', fb.parent.pattern, fb.redirect);
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

// Экспорт meta из route.js
export const meta = getMeta; 