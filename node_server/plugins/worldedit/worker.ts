import { BLOCK } from "../../../www/src/blocks.js";
import { Vector } from "../../../www/src/helpers.js";
import { SchematicReader } from "./schematic_reader.js";

let parentPort
import('worker_threads').then(module => {
    parentPort = module.parentPort;
    parentPort.on('message', onMessageFunc);
})

await BLOCK.init({
    _json_url: '../../../www/data/block_style.json',
    _resource_packs_url: '../../../www/data/resource_packs.json'
})

function postMessage(message) {
    parentPort.postMessage(message)
}

// On message callback function
async function onMessageFunc(e) {
    let data = e;
    if(typeof e == 'object' && 'data' in e) {
        data = e.data;
    }
    // console.log('chat_worldedit -> worker', data)
    const cmd = data[0]
    const args = data[1]
    switch(cmd) {
        case 'schem_load': {
            try {
                let p = performance.now();
                const reader = new SchematicReader();
                const schem = await reader.read(args.filename)
                if(reader.blocks.size > 0) {
                    p = Math.round((performance.now() - p) * 1000) / 1000000;
                    console.log('schematic version', schem.version);
                    const size = new Vector(schem.size).toHash();
                    const msg = `... loaded (${reader.blocks.size} blocks, size: ${size}, load time: ${p} sec). Version: ${schem.version}. Paste it with //paste`;
                    const _world_edit_copy = {
                        quboid: null,
                        blocks: reader.blocks,
                        fluids: reader.fluids,
                        player_pos: null
                    }
                    postMessage(['schem_loaded', {args, msg, _world_edit_copy}])
                }
            } catch(e) {
                postMessage(['schem_error', {args, e}])
            }
            break
        }
    }
}