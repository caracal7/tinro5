<script>
    import {getContext, setContext, onMount} from 'svelte';
    import {createRouteObject, router} from './tinro_internal.js';

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
