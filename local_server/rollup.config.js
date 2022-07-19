import commonjs from '@rollup/plugin-commonjs';
import { importAssertionsPlugin } from 'rollup-plugin-import-assert';
import { importAssertions } from 'acorn-import-assertions';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import replace from '@rollup/plugin-replace';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [{
    input: './index.js',
    treeshake: false,
    output: {
        inlineDynamicImports: true,
        file: '../www/js-gen/local_server.js',
        format: 'es' // es | cjs
    },
    acornInjectPlugins: [ importAssertions ],
    plugins: [
        commonjs(),
        importAssertionsPlugin(),
        dynamicImportVars({
            warnOnError: false,
            exclude: [
                '**/plugins/worldedit/schematic_reader.js',
            ]
        }),
        replace({
            delimiters: ['', ''],
            "import path from 'path';": "// import path from 'path';",
            "import sqlite3 from 'sqlite3';": "// import sqlite3 from 'sqlite3';",
            "import { open } from 'sqlite';": "// import { open } from 'sqlite';",
            "import { copyFile } from 'fs/promises';": "// import { copyFile } from 'fs/promises';",
            "import { Schematic } from 'prismarine-schematic';": "// import { Schematic } from 'prismarine-schematic';",
            "import { promises } from 'fs';": "// import { promises } from 'fs';",
            __buildDate__: () => new Date().toISOString()
        }),
        nodeResolve({
            // use "jsnext:main" if possible
            // see https://github.com/rollup/rollup/wiki/jsnext:main
            resolveOnly: ['sql.js', 'sql.js/dist/sql-wasm.js'],
            jsnext: true
        })
    ]  
}]
