import { BLOCK } from "@client/blocks.js";
import type { GameSettings } from "@client/game.js";
import { Vector } from "@client/helpers/vector.js";
import { SchematicReader } from "./schematic_reader.js";
import {ChunkGrid} from "@client/core/ChunkGrid.js";
import type {TQueryBlocksArgs, TQueryBlocksReply} from "./schematic_job.js";
import type {TSchematicInfo} from "../chat_worldedit.js";

let initializeResolve: Function
const initializePromise = new Promise(resolve => initializeResolve = resolve)

let parentPort : any
let bm : typeof BLOCK
let grid : ChunkGrid
let worldGUID : string
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
        worldGUID = args.worldGUID
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
                const info: TSchematicInfo = args.info
                // если уже была загружена схематика - забыть ее
                await currentReader?.close()
                currentReader = null
                // загрузить
                const reader = new SchematicReader(bm, grid)
                await reader.open(info, worldGUID)
                const schem = reader.schematic
                p = Math.round(performance.now() - p) * 0.001;
                // подготовить ответ
                console.log('schematic version', schem.version);
                const size = new Vector(schem.size)
                const offset = schem.offset && new Vector(schem.offset)
                let msg: string | null = null
                if (!info.resume) {
                    msg = `!lang... loaded (${size.volume()} blocks, size: ${size.toHash()}, offset: ${offset?.toHash()}, palette: ${schem.palette.length}, load time: ${p} sec). Version: ${schem.version}.`
                    if (info.fileCookie.useExternalParser) {
                        msg += '\nThe new parser has failed, using the old loader!'
                    } else if (args.info.fileCookie.tmpFileCtimeMs) {
                        msg += ' Using a temporary file.'
                    }
                    msg += `\nPaste it with /paste`
                }
                currentReader = reader
                postMessage(['schem_loaded', {args, msg, info}])
                break
            }
            case 'schem_update_info': {  // устанавливает параметры pos и rotate перед запросом блоков
                currentReader.updateInfo(args.info)
                break
            }
            case 'schem_query_blocks': { // вернуть блоки схематики в заданном AABB для вставки в мир
                const args: TQueryBlocksArgs = argsCopy
                checkLoaded()
                const chunks = currentReader.getByChunks(args.aabbInSchem)
                const msg: TQueryBlocksReply = {args, chunks}
                postMessage(['schem_blocks', msg])
                break
            }
            case 'schem_clear': {
                await currentReader?.close()
                currentReader = null
                postMessage(['schem_cleared', {args}])
                break
            }
        }
    } catch(e) {
        currentReader = null
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