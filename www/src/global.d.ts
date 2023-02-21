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
declare type tupleFloat3 = [number, number, number, number]
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
interface IColor {
    r: number;
    g: number;
    b: number;
}

interface IVectorPoint extends IVector {
    n : IVector
    point : IVector
}

interface TSideSet {}

declare interface TWorldInfo {

    id:             int
    user_id:        int
    dt:             any
    guid:           string
    title:          string
    seed:           string
    ore_seed:       string
    game_mode:      string
    generator:      {
        id: string
    }
    pos_spawn:      IVector
    rules:          Dict<any>
    state:          object
    add_time:       int
    world_type_id:  int
    recovery:       binary
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
    tag?: any,
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

interface IBlockTexture extends IBlockSides {
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

interface IBuildingItem {
    move: IVector
    block_id: int
    extra_data?: any
    rotate?: any
}

interface IBlockMiningMaterial {
    id: string
    mining: {
        blast_resistance: number
        time: number
        instruments: string[]
    }
    getMiningTime(instrument : object | any, force : boolean) : float
}

interface IPlane {
    size?: IVector
    /**
     * @deprecated
     */
    dir?: int
    move?: IVector
    uv: tupleFloat2
    rot: tupleFloat3 | IVector
}

interface IBlockMaterial {
    id: int
    name: string
    title: string
    style: string
    style_name: string
    support_style: string
    inventory_style: any
    group: string
    passable: number
    power: number
    /**
     * @deprecated
     */
    next_part: {
        id: int
        offset_pos: IVector
    }
    /**
     * @deprecated
     */
    previous_part: {
        id: int
        offset_pos: IVector
    }
    layering: any
    redstone: any
    random_ticker: string
    resource_pack: any
    extra_data: any
    item: {
        name: string
        emit_on_set: string
    }
    armor: {
        slot: int
        durability: number
        damage: number
    }
    inventory: {
        style: string
        scale: number
        texture: string | IBlockTexture
        move: IVector
        rotate: IVector
    }
    chest: {
        slots: int
        private: boolean
    }
    ticking: {
        type: string
        max_stage?: number
        times_per_stage?: number
    },
    drop_item: {
        name : string
        count? : number
        chance?: float
    }
    bb: any
    planes: IPlane[]
    tx_cnt: number
    material: IBlockMiningMaterial
    material_key: string
    texture: any
    texture_animations: any
    multiply_color: IColor
    mask_color: IColor
    has_head: {pos: IVector}
    // boolean values
    spawnable: boolean
    planting: boolean
    deprecated: boolean
    transparent: boolean
    diagonal: boolean
    uvlock: boolean
    gravity: boolean // Is sand or gravel
    random_rotate_up: boolean // Need to random rotate top texture
    can_rotate: boolean
    has_oxygen: boolean
    draw_only_down: boolean
    is_fluid: boolean
    is_button: boolean
    is_simple_qube: boolean
    is_solid: boolean
    is_water: boolean
    is_dynamic_light: boolean
    is_dirt: boolean
    is_layering: boolean
    is_leaves: int // LEAVES_TYPE
    is_entity: boolean
    is_portal: boolean
    is_glass: boolean
    is_grass: boolean
    is_battery: boolean
    coocked_item: { count: number, name: string }
    fuel_time: number
    //
    tags: string[]
    rotate: IVector
    aabb_size: IVector
    width: float
    height: float
    depth: float
    light_power: {r: float, g: float, b: float, a: float}
    light_power_number: number
    sound: string
    inventory_icon_id?: number
    max_in_stack: number
}