<script>
    import { onMount, tick, onDestroy } from 'svelte';
    import { createRouteObject } from './tinro_internal.js';


    /*
        let { path = '/*',
        fallback = false,
        redirect = false,
        firstmatch = false,
        breadcrumb = null,
        meta = undefined,
        children } = $props();
    */

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



    // Добавляем флаг для отслеживания состояния монтирования
    let isMounted = false;

    // Регистрируем маршрут при монтировании
    onMount(() => {

        const route = createRouteObject({
            fallback,
            onShow() {
                if(showContent === true) return;
                showContent = true;
                _meta2 = _meta;
                console.log('onShow');
                Update();
            },
            onHide(...args) {
                if(showContent === false) return;
                showContent = false;
                console.log('onHide');
                Update();
            },
            onMeta(newmeta) {
                _meta = newmeta;
                console.log('onMeta', newmeta);
                Update();
            }
        });
        // Реактивное обновление параметров маршрута с проверкой isMounted
        function Update() {
            if (isMounted) route.update({
                path,
                redirect,
                firstmatch,
                breadcrumb,
            });
        };


        isMounted = true;
        const unregister = route.register();
        Update();

        return () => {
            isMounted = false;
            unregister();
        };
    });






</script>

{#if showContent}
    {#if meta}
        {@render meta(_meta2)}
    {:else}
        {@render children?.()}
    {/if}
{/if}
