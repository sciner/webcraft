import { Compiler } from "./compiler.js";
import { BBModel_Compiler } from "./bbmodel_compiler.js";
import { Music_Compiler } from "./music_compiler.js";
import { BBMODEL_TX_CNT, DEFAULT_TX_SIZE } from "@client/constant.js";

// Textures
const compiler = new Compiler({
    resolution: 32,
    texture_pack_dir: [
        '../../../resource-packs/1',
        '../../../resource-packs/2',
        '../../../resource-packs/depixel',
    ],
    output_dir: "../../www/resource_packs/base",
    base_conf: "../../www/resource_packs/base/conf.json",
    compile_json: "../../data/assets/compile.json",
    copy_files: [
        '../../data/assets/textures/painting.png',
        '../../data/assets/textures/alphabet_msdf.png',
    ]
});
await compiler.init();
await compiler.run();

// BBmodels
const bbcompiler = new BBModel_Compiler({
    resolution:         DEFAULT_TX_SIZE,
    tx_cnt:             BBMODEL_TX_CNT,
    model_dir:          "../../data/assets/bbmodel/models",
    output_dir:         "../../www/resource_packs/bbmodel",
    conf:               "../../data/assets/bbmodel/conf.json",
    // texture_pack_dir:   options.texture_pack_dir,
});
await bbcompiler.init();
await bbcompiler.run(compiler);

// Music
const musiccomipller = new Music_Compiler()
await musiccomipller.run()