import { BLOCK } from "@client/blocks.js";
import type { GameSettings } from "@client/game.js";
import { Vector } from "@client/helpers/vector.js";
import { SchematicReader } from "./schematic_reader.js";
import type {TWorldEditCopy} from "../chat_worldedit.js";
import {ChunkGrid} from "@client/core/ChunkGrid.js";
import type {TQueryBlocksArgs, TQueryBlocksReply} from "./schematic_job.js";

let initializeResolve: Function
const initializePromise = new Promise(resolve => initializeResolve = resolve)

let parentPort : any
let bm : typeof BLOCK
let grid : ChunkGrid
/**
 * Текущая загруженная схематика. В мире может быть одновременно загружена только одна (для простоты,
 * и для ограничения ресурсов).
 */
let currentReader: SchematicReader | null = null

// сообщения, полученные до инициализации
const missedMessages = []

import('worker_threads').then(module => {
    parentPort = module.parentPort;
    parentPort.on('message', onMessageFunc);
})

function postMessage(message) {
    parentPort.postMessage(message)
}

async function initBlockManager() : Promise<typeof BLOCK> {
    return bm || (bm = await BLOCK.init({
        _json_url: '../../../data/block_style.json',
        _resource_packs_url: '../../../data/resource_packs.json'
    } as GameSettings))
}

// On message callback function
async function onMessageFunc(e) {

    const checkLoaded: () => void = () => {
        if (!currentReader) {
            throw `!langA schematic isn't loaded`
        }
    }

    let data = e;
    if(typeof e == 'object' && 'data' in e) {
        data = e.data;
    }
    const [cmd, args] = data

    // либо инициализируем, либо ждем пока инициализирется
    if (cmd === 'init') {
        await initBlockManager()
        grid = new ChunkGrid(args.chunkGridOptions)
        initializeResolve()
        return
    } else {
        await initializePromise
    }

    // console.log('chat_worldedit -> worker', data)
    const argsCopy = args // чтобы можно было повторно args конкретного типа
    let p = performance.now()
    try {
        switch(cmd) {
            case 'schem_load': { // грузит схематику, возвращает информацию о ней, не блоки
                currentReader = null
                // загрузить
                const reader = new SchematicReader(grid)
                const info = await reader.read(args.filename, args.useExternalParser)
                const schem = reader.schematic
                info.user_id = args.user_id
                info.username = args.username
                p = Math.round(performance.now() - p) * 0.001;
                // подготовить ответ
                console.log('schematic version', schem.version);
                const size = new Vector(schem.size)
                const offset = schem.offset && new Vector(schem.offset)
                const msg = `!lang... loaded (palette: ${schem.palette.length}, volume: ${size.volume()}, size: ${size.toHash()}, offset: ${offset?.toHash()}, load time: ${p} sec). Version: ${schem.version}. Use "/schem copy" or "/schem start".`;
                currentReader = reader
                postMessage(['schem_loaded', {args, msg, info}])
                break
            }
            case 'schem_query_blocks': { // вернуть блоки схематики в заданном AABB для вставки в мир
                const args: TQueryBlocksArgs = argsCopy
                checkLoaded()
                const aabb = args.aabbInSchem
                const chunks = currentReader.getByChunks(args.pos, aabb, args.air_y)
                const msg: TQueryBlocksReply = {args, chunks}
                postMessage(['schem_blocks', msg])
                break
            }
            case 'schem_copy': { // вернуть все блоки схематики для буфера обмена
                checkLoaded()
                const [blocks, fluids] = currentReader.getAll(args.copy_air)
                p = Math.round(performance.now() - p) * 0.001;
                const msg = `... copied (${blocks.size} blocks, fluid: ${fluids.length / 4}, time: ${p} sec). Paste it with /paste`;
                const _world_edit_copy: TWorldEditCopy = {
                    quboid: null,
                    blocks,
                    fluids,
                    player_pos: null
                }
                postMessage(['schem_copied', {args, msg, _world_edit_copy}])
                break
            }
            case 'schem_clear': {
                checkLoaded()
                currentReader = null
                postMessage(['schem_cleared', {args}])
                break
            }
        }
    } catch(e) {
        console.log('Error in schematic worker: ', e)
        if (typeof e !== 'string') {
            e = 'Error in schematic worker: ' + e
        }
        if (!e.startsWith('!lang')) {
            e = '!lang' + e
        }
        postMessage(['schem_error', {args, e}])
    }
}