import commonjs from '@rollup/plugin-commonjs';

export default [{
    input: '../www/js/chunk_worker.js',
    treeshake: false,
    output: {
        inlineDynamicImports: true,
        file: '../www/js-gen/ff-chunk-worker.js',
        format: 'cjs'//'es',//'cjs',
    },
    plugins: [
        commonjs()
    ],
   
}
,
{
    input: '../www/js/light_worker.js',
    treeshake: false,
    output: {
        inlineDynamicImports: true,
        file: '../www/js-gen/ff-light-worker.js',
        format: 'cjs',
    },
    plugins: [commonjs()]
}
]
