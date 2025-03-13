<script>
    import {createRouteObject} from './../dist/tinro_lib';

    const { path = '/*', fallback = false, redirect = false, firstmatch = false, breadcrumb = null } = $props();

    let showContent = false;
    let params = {}; /* DEPRECATED */
    let meta = {};

    const route = createRouteObject({
        fallback,
        onShow(){showContent=true},
        onHide(){showContent=false},
        onMeta(newmeta){
            meta=newmeta;
            params = meta.params /* DEPRECATED */
        }
    });

    $effect(() => {
        route.update({
            path,
            redirect,
            firstmatch,
            breadcrumb,
        });
    });
</script>

{#if showContent}
    <slot {params} {meta}></slot>
{/if}
