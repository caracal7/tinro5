const esbuild = require('esbuild');
const sveltePlugin = require('esbuild-svelte');
const pkg = require('./package.json');

(async () => {
    const commonConfig = {
        minify: true,
        external: [
            'svelte',
            'svelte/*'
        ],
        target: ['es2020']
    };

    const svelteOptions = {
        compilerOptions: {
            runes: true,
            generate: 'dom',
            cssHash: ({ hash, css }) => `tinro-${hash}`,
            enableSourcemap: true,
            dev: true
        }
    };

    await esbuild.build({
        ...commonConfig,
        entryPoints: ['src/tinro.js'],
        bundle: true,
        outfile: 'dist/tinro_lib.js',
        format: 'esm'
    });

    await esbuild.build({
        ...commonConfig,
        entryPoints: ['cmp/index.js'],
        bundle: true,
        outfile: pkg.module,
        format: 'esm',
        plugins: [sveltePlugin(svelteOptions)]
    });

    await esbuild.build({
        ...commonConfig,
        entryPoints: ['cmp/index.js'],
        bundle: true,
        outfile: pkg.main,
        format: 'cjs',
        plugins: [sveltePlugin(svelteOptions)]
    });
})();
