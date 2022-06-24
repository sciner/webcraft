import { Compiler } from "./compiler.js";

const options = {
    TX_SZ: 32,
    textures_dir: 'c:/texture-pack/assets/minecraft/textures',
    output_dir: "../../www/resource_packs/base",
    base_conf: "../../www/resource_packs/base/conf.json",
    compile_json: "./compile.json"
};

const compiler = new Compiler(options);
await compiler.init();
compiler.run();