declare const config: any
declare const Log: any
declare const fs: any
declare const path: any
declare const skiaCanvas: any
declare const mkdirp: any
declare const plugins: any

/**
 * A type that can be saved in DB as a blob.
 * Int32Array is not included because it's not supported bu qubatch-single.
 */
declare type BLOB = Uint8Array | Buffer

/** Types that can be saved to a DB via JSON */
declare type DBJsonParam = null | number | string

/** Types that can be saved to a DB */
declare type DBParam = DBJsonParam | BLOB

/** An object with the named query paramters */
declare type DBQueryNamedParams = {
    [key: string]: DBParam
}

declare type DBQueryParams = DBQueryNamedParams | DBParam[] | DBParam

declare type DBRunQueryResult = {
    lastID? : int
    changes? : int
}

interface DBConnection {
    get(sql: string, params?: DBQueryParams, ...moreParams: DBParam[]): Promise<any>
    all(sql: string, params?: DBQueryParams, ...moreParams: DBParam[]): Promise<any[]>
    run(sql: string, params?: DBQueryParams, ...moreParams: DBParam[]): Promise<DBRunQueryResult>
}

// client side variables =(
//@ts-ignore
declare const Qubatch: any
//@ts-ignore
declare const vt: any
//@ts-ignore
declare const worker: any
// declare const UI_ZOOM: any
// declare const LocalServerClient: any

// interface IBuildingItem {
//     move: Vector
//     block_id: int
//     extra_data: any
//     rotate: any
// }

// interface Dict<ValueType=any> {
//     [key: string]: ValueType
// }

declare const EMULATED_PING: number
declare const SERVER_TIME_LAG: number