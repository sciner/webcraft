// This file is .d.ts because we can't use imports in chunk_worker.ts
// see the TS bug https://github.com/microsoft/TypeScript/issues/44040

type TChunkWorkerMessageInit = {
    generator           : TGeneratorInfo
    world_seed          : string
    world_guid          : string
    settings            : TBlocksSettings
    resource_cache?     : Map<any, any>
    is_server           : boolean
    world_tech_info     : TWorldTechInfo
}

type TScannedTickers = {
    randomTickersCount: int
    tickerFlatIndices: int[]
}

type TChunkWorkerMessageBlocksGenerated = {
    addr:                   IVector
    uniqId:                 int
    tblocks:                any
    packedCells:            Int16Array
    genQueueSize?:          int
    dayLightDefaultValue?:  int
    tickers:                TScannedTickers | null
    // randomTickersCount:  int
    // tickerFlatIndices:   int[]
}