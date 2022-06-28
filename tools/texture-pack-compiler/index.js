import fs from 'fs'
import { Compiler } from "./compiler.js";


const name = process.argv[2] || 'default'
const texturePackDir = `./resource-packs/${name}`

if (!fs.existsSync(texturePackDir)) {
    console.log(`Resource pack not found.\nPut your folder in ./resource-packs/${name}`)
    process.exit(1)
} 

const options = {
    resolution: 32,
    texture_pack_dir: texturePackDir,
    output_dir: "../../www/resource_packs/base",
    base_conf: "../../www/resource_packs/base/conf.json",
    compile_json: "./compile.json",
    copy_files: [
        'textures/painting.png',
        'textures/alphabet_msdf.png'
    ]
};

const compiler = new Compiler(options);
await compiler.init();
compiler.run();