import { BBModel_Compiler } from "./bbmodel_compiler.js";
import { Compiler } from "./compiler.js";

const options = {
    resolution: 32,
    texture_pack_dir: [
        // '../../../resource-packs/faithfull_pbr',
        '../../../resource-packs/2',
        '../../../resource-packs/depixel',
    ],
    output_dir: "../../www/resource_packs/base",
    base_conf: "../../www/resource_packs/base/conf.json",
    compile_json: "./compile.json",
    copy_files: [
        'textures/painting.png',
        'textures/alphabet_msdf.png',
    ]
};

// Textures
const compiler = new Compiler(options);
await compiler.init();
compiler.run();

// bbmodels
const bbcompiler = new BBModel_Compiler({
    resolution:         32,
    tx_cnt:             32,
    model_dir:          "./bbmodel/models",
    output_dir:         "../../www/resource_packs/bbmodel",
    conf:               "./bbmodel/conf.json",
    texture_pack_dir:   options.texture_pack_dir,
});
await bbcompiler.init();
await bbcompiler.run();