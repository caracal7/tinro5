<script>
    import { createRouteObject } from './tinro';
    import { onMount } from 'svelte';

    let {
        path = '/*',
        fallback = false,
        redirect = false,
        firstmatch = false,
        breadcrumb = null,
        children,
        meta
    } = $props();

    let showContent = $state(false);

    let _meta = {};
    let _meta2 = $state({});

    // Регистрируем маршрут при монтировании
    onMount(() => {

        const route = createRouteObject({
            fallback,
            onShow(){
                if(showContent === true) return;
                showContent = true;
                _meta2 = _meta;
            },
            onHide(...args){
                if(showContent === false) return;
                showContent = false;

            },
            onMeta(newmeta){
                _meta = newmeta;
            }
        });

        route.update({
            path,
            redirect,
            firstmatch,
            breadcrumb,
        });

        return () => {

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
