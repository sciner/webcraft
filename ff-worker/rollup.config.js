import commonjs from '@rollup/plugin-commonjs';

export default [{
    input: './chunk_worker_bundle.js',
    treeshake: false,
    output: {
        inlineDynamicImports: true,
        file: '../www/js-gen/chunk_worker_bundle.js',
        format: 'cjs'//'es',//'cjs',
    },
    plugins: [
        commonjs()
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
    plugins: [commonjs()]
}
]
