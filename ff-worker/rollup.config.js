import commonjs from '@rollup/plugin-commonjs';
import { importAssertionsPlugin } from 'rollup-plugin-import-assert';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';

export default [{
    input: './chunk_worker_bundle.js',
    treeshake: false,
    output: {
        inlineDynamicImports: true,
        file: '../www/js-gen/chunk_worker_bundle.js',
        format: 'es'//'es',//'cjs',
    },
    plugins: [
        importAssertionsPlugin(),
        dynamicImportVars({
            warnOnError: false
        }),
        nodeResolve(),
        commonjs()
    ]
   
}
,
{
    input: './light_worker_bundle.js',
    treeshake: false,
    output: {
        inlineDynamicImports: true,
        file: '../www/js-gen/light_worker_bundle.js',
        format: 'cjs',
    },
    plugins: [commonjs()]
}
,
{
    input: './controller_bundle.js',
    treeshake: false,
    output: {
        inlineDynamicImports: true,
        file: '../www/js-gen/controller_bundle.js',
        format: 'cjs',
    },
    plugins: [
        importAssertionsPlugin(),
        dynamicImportVars({
            warnOnError: false
        }),
        nodeResolve(),
        commonjs()
    ]
}
]
