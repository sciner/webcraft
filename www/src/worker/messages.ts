
export type TBlocksGeneratedWorkerMessage = {
    addr: IVector
    uniqId: int
    tblocks
    packedCells: Int16Array
    genQueueSize?: int
}