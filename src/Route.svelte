<script>
    import {getContext, hasContext, setContext, onMount} from 'svelte';
    import {writable, get} from 'svelte/store';

    // MODES
    const MODES = {
        HISTORY: 1,
        HASH: 2,
        MEMORY: 3,
        OFF: 4,
        run(mode,fnHistory,fnHash,fnMemory){
            return mode === this.HISTORY
                ? fnHistory && fnHistory()
                : mode === this.HASH
                    ? fnHash && fnHash()
                    : fnMemory && fnMemory()
        },
        getDefault(){
            return !window || window.location.pathname === 'srcdoc' ? this.MEMORY : this.HISTORY;
        }
    };

    // Utility functions
    function formatPath(path,slash=false){
        path = path.slice(
            path.startsWith('/#') ? 2 : 0,
            path.endsWith('/*') ? -2 : undefined
        )
        if(!path.startsWith('/')) path = '/'+path;
        if(path==='/') path = '';
        if(slash && !path.endsWith('/')) path += '/';
        return path;
    }

    function getRouteMatch(pattern,path){
        pattern = formatPath(pattern,true);
        path = formatPath(path,true);

        const keys = [];
        let params = {};
        let exact = true;
        let rx = pattern
           .split('/')
           .map(s => s.startsWith(':') ? (keys.push(s.slice(1)),'([^\\/]+)') : s)
           .join('\\/');

        let match = path.match(new RegExp(`^${rx}$`));
        if(!match) {
            exact = false;
            match = path.match(new RegExp(`^${rx}`));
        }
        if(!match) return null;
        keys.forEach((key,i) => params[key] = match[i+1]);

        return {
            exact,
            params,
            part:match[0].slice(0,-1)
        }
    }

    function parseQuery(str){
        const o = str.split('&')
          .map(p => p.split('='))
          .reduce((r,p) => {
              const name = p[0];
              if(!name) return r;
              let value = p.length > 1 ? p[p.length-1] : true;
              if(typeof value === 'string' && value.includes(',')) value = value.split(',');
              (r[name] === undefined) ? r[name]=[value] : r[name].push(value);
              return r;
          },{});

        return Object.entries(o).reduce((r,p)=>(r[p[0]]=p[1].length>1 ? p[1] : p[1][0],r),{});
    }

    function makeQuery(obj){
        return Object.entries(obj).map(([name,value])=>{
            if(!value) return null;
            if(value === true) return name;
            return `${name}=${Array.isArray(value) ? value.join(',') : value}`;
        }).filter(e=>e).join('&');
    }

    function prefix(str, prefix){
        return !str ? '' : prefix+str;
    }

    // Location handling
    let memoURL;
    let from;
    let last;
    let base = '';

    function createLocation(){
        let MODE = MODES.getDefault();
        let listener;

        const reset = _ => window.onhashchange = window.onpopstate = memoURL = null;
        const dispatch = _ => listener && listener(readLocation(MODE));

        const setMode = newMode => {
            newMode && (MODE = newMode);
            reset();
            MODE !== MODES.OFF
            && MODES.run( MODE ,
                _ => window.onpopstate = dispatch,
                _ => window.onhashchange = dispatch
            )
            && dispatch()
        }

        return {
            mode: setMode,
            get: _ => readLocation(MODE),
            go(href,replace){
                writeLocation(MODE,href,replace);
                dispatch();
            },
            start(fn){
                listener = fn;
                setMode()
            },
            stop(){
                listener = null;
                setMode(MODES.OFF)
            }
        }
    }

    function writeLocation(MODE, href, replace){
        !replace && (from=last);

        const setURL = (url) => history[`${replace ? 'replace' : 'push'}State`]({}, '', url);

        MODES.run( MODE,
            _ => setURL(base+href),
            _ => setURL(`#${href}`),
            _ => memoURL = href
        );
    }

    function readLocation(MODE){
        const l = window.location;
        const url = MODES.run( MODE,
            _ => (base ? l.pathname.replace(base,'') : l.pathname)+l.search+l.hash,
            _ => String(l.hash.slice(1)||'/'),
            _ => memoURL || '/'
        );

        const match = url.match(/^([^?#]+)(?:\?([^#]+))?(?:\#(.+))?$/);

        last=url;

        return {
            url,
            from,
            path: match[1] || '',
            query: parseQuery(match[2] || ''),
            hash: match[3] || '',
        };
    }

    // Router store
    const location = createLocation();
    export const router = routerStore();

    function routerStore(){
        const {subscribe} = writable(location.get(), set => {
            location.start(set);
            return () => location.stop();
        });

        return {
            subscribe,
            goto: location.go
        }
    }

    // Route creation
    const CTX = 'tinro';

    const ROOT = {
        pattern: '',
        matched: true,
        router: {},
        exact: false,
        meta: null,
        parent: null,
        fallback: false,
        redirect: false,
        firstmatch: false,
        breadcrumb: null,
        childs: new Set(),
        activeChilds: new Set(),
        fallbacks: new Set(),
    };

    // Component props
    export let path = '/*';
    export let fallback = false;
    export let redirect = false;
    export let firstmatch = false;
    export let breadcrumb = null;
    export let meta;
    export let children;

    let showContent = false;
    let _meta = {};
    let _meta2 = {};
    let mounted = false;

    const parent = hasContext(CTX) ? getContext(CTX) : ROOT;
    const metaStore = writable({});

    const route = {
        fallback,
        parent,
        exact: false,
        pattern: null,
        meta: null,
        router: {},
        redirect: false,
        firstmatch: false,
        breadcrumb: null,
        matched: false,
        childs: new Set(),
        activeChilds: new Set(),
        fallbacks: new Set(),

        update(opts) {
            this.exact = !opts.path.endsWith('/*');
            this.pattern = formatPath(`${this.parent.pattern || ''}${opts.path}`);
            this.redirect = opts.redirect;
            this.firstmatch = opts.firstmatch;
            this.breadcrumb = opts.breadcrumb;
            this.match();
        },

        start() {
            if(this.router.un) return;
            this.router.un = router.subscribe(r => {
                this.router.location = r;
                if(this.pattern !== null) this.match();
            });
        },

        match() {
            this.matched = false;
            const {path, url, from, query} = this.router.location;
            const match = getRouteMatch(this.pattern, path);

            if(!this.fallback && match && this.redirect && (!this.exact || (this.exact && match.exact))){
                return router.goto(match.part + this.redirect, true);
            }

            this.meta = match && {
                from,
                url,
                query,
                match: match.part,
                pattern: this.pattern,
                params: match.params,
                subscribe: metaStore.subscribe
            }

            metaStore.set(this.meta);

            if(match && !this.fallback && (!this.exact || (this.exact && match.exact))){
                showContent = true;
                _meta2 = this.meta;
                !this.fallback && this.parent.activeChilds.add(this);
            } else {
                showContent = false;
                this.parent.activeChilds.delete(this);
            }
        }
    };

    setContext(CTX, route);

    onMount(() => {
        mounted = true;
        const unregister = () => {
            route.parent.childs.delete(route);
            route.parent.activeChilds.delete(route);
            route.router.un && route.router.un();
            mounted = false;
            showContent = false;
        };

        route.parent[fallback ? 'fallbacks' : 'childs'].add(route);
        route.start();

        return unregister;
    });

    $: if (mounted) {
        route.update({
            path,
            redirect,
            firstmatch,
            breadcrumb,
        });
    }
</script>

{#if showContent}
    {#if meta}
        {@render meta(_meta2)}
    {:else}
        {@render children?.()}
    {/if}
{/if}
