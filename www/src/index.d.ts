//
declare const angular: any
declare const SlimSelect: any
declare const Howler: any
declare const Howl: any
declare const LocalServerClient: any
declare const Qubatch: any // GameClass // | ServerGame
declare const BLOCK: any;
declare const QubatchChunkWorker: any;
declare const QubatchLightWorker: any;
declare const UI_ZOOM: number
declare const vt: any
declare const TrackerPlayer: any
declare function randomUUID() : string

//
declare type float = number&{};
declare type int = number&{};
declare type byte = number&{};
declare type imat3 = float[];
declare type imat4 = float[] | Float32Array;

declare type tupleFloat6 = [number, number, number, number, number, number]
declare type tupleFloat4 = [number, number, number, number]
declare type tupleFloat2 = [number, number]

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