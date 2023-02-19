//
declare const Qubatch: any // GameClass // | ServerGame
declare const QubatchChunkWorker: any;
declare const QubatchLightWorker: any;
declare function randomUUID() : string

//
declare type float = number&{};
declare type int = number&{};
declare type byte = number&{};
declare type imat3 = float[];
declare type imat4 = float[] | Float32Array;
declare type binary = any

declare type tupleFloat6 = [number, number, number, number, number, number]
declare type tupleFloat4 = [number, number, number, number]
declare type tupleFloat2 = [number, number]

declare type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array
    | Int16Array | Int32Array | Uint8ClampedArray | Float32Array | Float64Array
declare type AnyArray = any[] | TypedArray

/**
 * A object like Vector
 */
interface IVector {
    x: number;
    y: number;
    z: number;
}

interface TSideSet {}

interface TWorldInfo {
    world_type_id: int,
    rules: any,
    calendar: {
        day_time: any,
        age: any
    }
}

interface TWorldSettings {}

interface IChatCommand {
    name: int
    data: any,
    time: number,
}

interface IBlockItem {
    id: int
    extra_data?: any,
    power?: number,
    entity_id?: string,
    rotate? : IVector,
    count?: number,
}

interface Dict<ValueType=any> {
    [key: string]: ValueType
}

interface IBlockSides {
    up? : any
    down? : any
    north? : any
    south? : any
    east? : any
    west? : any
}

interface IBlockTexture {
    id?: string
    side? : any
    tx_cnt? : int
}

interface IWorld {
    getBlock(x : int | IVector, y? : int, z? : int) : any
}

interface IPlayer {
    session: any
}