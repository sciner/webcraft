import { Compiler } from "./compiler.js";
import { BBModel_Compiler } from "./bbmodel_compiler.js";
import { Music_Compiler } from "./music_compiler.js";

// Textures
const compiler = new Compiler({
    resolution: 32,
    texture_pack_dir: [
        // '../../../resource-packs/faithfull_pbr',
        '../../../resource-packs/1',
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
});
await compiler.init();
compiler.run();

// BBmodels
const bbcompiler = new BBModel_Compiler({
    resolution:         32,
    tx_cnt:             32,
    model_dir:          "./bbmodel/models",
    output_dir:         "../../www/resource_packs/bbmodel",
    conf:               "./bbmodel/conf.json",
    // texture_pack_dir:   options.texture_pack_dir,
});
await bbcompiler.init();
await bbcompiler.run(compiler);

// Music
const musiccomipller = new Music_Compiler()
await musiccomipller.run()