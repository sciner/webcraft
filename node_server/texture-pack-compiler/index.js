import { Compiler } from "./compiler.js";

const options = {
    resolution: 32,
    texture_pack_dir: '../../../resource-packs/1',
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