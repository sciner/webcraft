import type {TBlocksSavedState} from "../typed_blocks3.js";

export type TChunkWorkerMessageInit = {
    generator           : TGeneratorInfo
    world_seed          : string
    world_guid          : string
    settings            : TBlocksSettings
    resource_cache?     : Map<any, any>
    is_server           : boolean
    world_tech_info     : TWorldTechInfo
}

export type TScannedTickers = {
    randomTickersCount: int
    randomTickerFlatIndices: int[] | null // индексы случайных тикеров, если их не больше чем FAST_RANDOM_TICKERS_PERCENT * объем
    tickerFlatIndices: int[]
}

export type TChunkWorkerMessageBlocksGenerated = {
    addr:                   IVector
    uniqId:                 int
    tblocks:                TBlocksSavedState
    packedCells:            Int16Array
    genQueueSize?:          int
    dayLightDefaultValue?:  int
    tickers:                TScannedTickers | null
    for_schematic?:         { job_id: int, index: int }
}