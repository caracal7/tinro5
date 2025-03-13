<script>
    import { createRouteObject } from './tinro';


/*
    let {
        path = '/*',
        fallback = false,
        redirect = false,
        firstmatch = false,
        breadcrumb = null,
        children,
        meta
    } = $props();
*/

        export let path = '/*';
        export let fallback = false;
        export let redirect = false;
        export let firstmatch = false;
        export let breadcrumb = null;
        export let meta;
        export let children;

    let showContent = false; //$state(false);

    let _meta = {};
    let _meta2 = {};//$state({});


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


//    $effect(() => {
    $:    route.update({
            path,
            redirect,
            firstmatch,
            breadcrumb,
        });
//    });

</script>


{#if showContent}
    {#if meta}
        {@render meta(_meta2)}
    {:else}
        {@render children?.()}
    {/if}
{/if}
