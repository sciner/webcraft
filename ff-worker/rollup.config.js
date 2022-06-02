export default {
    input: 'ff-chunk-worker.js',
    treeshake: false,
    output: {
        inlineDynamicImports: true,
        file: '../www/js-gen/ff-chunk-worker.js',
        format: 'cjs',
    }
}
