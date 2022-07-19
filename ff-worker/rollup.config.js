import commonjs from '@rollup/plugin-commonjs';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';

export default [{
    input: './chunk_worker_bundle.js',
    treeshake: false,
    output: {
        inlineDynamicImports: true,
        file: '../www/js-gen/chunk_worker_bundle.js',
        format: 'cjs'//'es',//'cjs',
    },
    plugins: [
        commonjs(),
        dynamicImportVars({})
    ],
   
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
    plugins: [
        commonjs(),
        dynamicImportVars({})
    ]
}
]
