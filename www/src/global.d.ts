//
//@ts-ignore
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

declare type scalar = number | string | boolean

declare type tupleFloat6 = [number, number, number, number, number, number]
declare type tupleFloat4 = [number, number, number, number]
declare type tupleFloat3 = [number, number, number]
declare type tupleInt3 = [int, int, int]
declare type tupleFloat2 = [number, number]
type ConcatTuple<T1 extends unknown[], T2 extends unknown[]> = [...T1, ...T2]

declare type TypedIntArray = Uint8Array | Uint16Array | Uint32Array | Int8Array
    | Int16Array | Int32Array | Uint8ClampedArray
declare type TypedArray = TypedIntArray | Float32Array | Float64Array
declare type AnyArray = any[] | TypedArray

/**
 * Describes block strides in a chunk, possibly with padding.
 * The members have the same semantics as in BaseChunk.
 */
type TBlockStrides = [cx: int, cy: int, cz: int, cw: int]

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

interface IChunk {
    addr: IVector
    coord: IVector
    size: IVector
}

interface TSideSet {}

type TGeneratorInfo = {
    id:             string
    cluster_size?:  IVector
    options: {
        [key: string]:  any
        bonus_chest?:   boolean
    }
    pos_spawn:      any
    rules:          any
}

declare interface TWorldTechInfo {
    chunk_size: IVector
}

declare interface TWorldInfo {

    id:             int
    user_id:        int
    dt:             any
    guid:           string
    title:          string
    seed:           string
    ore_seed:       string
    game_mode:      string
    generator:      TGeneratorInfo
    pos_spawn:      IVector
    rules:          Dict<any>
    state:          Dict    // Реальный тип - см. TServerWorldState
    add_time:       int
    world_type_id:  int
    recovery:       binary
    tech_info:      TWorldTechInfo
    calendar: {
        day_time: any,
        age: any
    }

}

/** A subset of the game settings needed for the chunk worker and BLOCK class */
interface TBlocksSettings {
    json_url?:                  string
    texture_pack?:              string
    resource_packs_url?:        string
    overlay_textures?:          boolean
    draw_improved_blocks?:      boolean
    beautiful_leaves?:          boolean
    resource_packs_basedir?:    string
    only_bbmodel?:              boolean
}

interface TWorldSettings extends TBlocksSettings {
    chunks_draw_debug_grid: boolean
    cluster_draw_debug_grid: boolean
    mobs_draw_debug_grid: boolean
    use_light: number
    chunk_geometry_mode: number
    chunk_geometry_alloc: number
    leaf_fall: boolean
}

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

interface IInventoryItem {
    id: int
    count: number
    extra_data?: any
    power?: number
    entity_id?: string
    texture?    // used only on client
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
    getBlock(pos : IVector, resultBlock?) : any
}

/**
 * An adapter with common properties of ServerPlayer and PlayerModel
 * that are declared differently and can't be accessed in the same from
 * ServerPlayer, Player and PlayerModel themselves.
 */
interface IPlayerSharedProps {
    isAlive     : boolean
    user_id     : int
    pos         : IVector
    sitting     : boolean
}

declare type PlayerSession = {
    flags       : int
    username    : string
    user_id     : int
    user_guid   : string
}

interface IPlayer {
    session: PlayerSession
}

/** Common properties of ServerPlayer, Player and PlayerModel */
interface IPlayerOrModel {
    height: number
    sharedProps: IPlayerSharedProps
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
    float?: boolean // если true, то не тонет в воде
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

interface IBlockSame {
    id: string
    properties: int
}

interface IBlockMaterialTicking {
    type: string
    max_stage?: number
    times_per_stage?: number
}

interface IBlockChance {
    block_id?: int
    name?: string
    chance: float
    rotate: any
    is_fluid: boolean
    is_lava: boolean
    is_water: boolean
    extra_data: any
    material: IBlockMaterial
}

interface IBlockDropItem {
    name:           string
    count?:         int
    chance?:        float
    min_max_count?: any
    instrument?:    string[]
}

interface IBlockMaterial {
    id: int
    name: string
    title: string
    style: string
    /**
     * Имя стиля, не зависящего от BB модели - для игровой логики и физики. Заполняется автоматически.
     * Если блок переопределялся несколко раз - то в нем хранится имя последнего стиля без BB модели.
     */
    style_name: string
    support_style: string
    sham_block_name: string
    same?: IBlockSame
    inventory_style: any
    group: string
    passable: number
    power: number
    protection: number
    can_auto_drop: boolean
    is_dummy: boolean
    previous_part: {
        id: int
        offset_pos: IVector
    }
    layering?: {
        height: float
        slab?: boolean
        full_block_name: string
    }
    flammable?: {
        catch_chance_modifier: float
        destroy_chance_modifier: float
    }
    compile: any
    redstone: any
    random_ticker: string
    /** Слушатели событий этого блока. См. BlockListeners */
    listeners?: string[]
    resource_pack: any
    extra_data: any
    aabb: tupleFloat6
    aabb_size: IVector
    item: {
        indicator? : any
        name: string
        emit_on_set: string,
        instrument_id? : string
    }
    armor: {
        slot: int
        durability: number
        damage: number
    }
    model: {
        geo: string,
        texture: string
    }
    seeds: {
        result: {
            incomplete: object[]
            complete: object[]
        }
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
        readonly_slots: int
    }
    ticking: IBlockMaterialTicking
    drop_item: IBlockDropItem
    generator? : {
        can_replace_to_slab: string
    }
    bb: {
        model:              string | any
        aabb_stylename?:    string
        behavior?:          string
        animated?:          {
            name?: string
        }
        select_texture?:    any
        set_state?:         any
        set_animation:      any
        particles?:         any
        rotate?:            any
    }
    flags: int // BLOCK_FLAG enum
    planes: IPlane[]
    tx_cnt: number
    material: IBlockMiningMaterial
    material_key: string
    // Textures
    texture: any
    texture_overlays: any // overlay-текстуры (песок, снег, земля, гравий и т.д., которые "высыпаются" на соседние блоки)
    overlay_textures_weight: number // Определяет порядок наслоения overlay-текстур друг на друга
    connected_sides: any
    stage_textures?: string[]
    texture_variants?: {}[]
    hanging_textures?: {ripe: string[], noripe: string[]}[]
    texture_animations: any
    //
    multiply_color: IColor
    mask_color: IColor
    has_head: {pos: IVector}
    window?: string
    spawn_egg?: {type, skin}
    damage?: number
    speed?: number
    food?: {
        amount: number,
        saturation: number
    }
    effects?: {
        id: int,
        time: int,
        level: int
    }[]
    piece_of?: string // если задано, то этот блок - кусочек другого блока (shard, nugget, и т.п.)
    // boolean values
    spawnable: boolean
    planting: boolean
    deprecated: boolean
    transparent: boolean
    diagonal: boolean
    uvlock: boolean
    selflit: boolean
    gravity: boolean // Is sand or gravel
    random_rotate_up: boolean // Need to random rotate top texture
    can_rotate: boolean
    has_oxygen: boolean
    has_powerbar: boolean
    draw_only_down: boolean
    is_fluid: boolean
    is_button: boolean
    is_simple_qube: boolean
    is_solid: boolean
    is_water: boolean
    is_lava: boolean
    is_dynamic_light: boolean
    is_dirt: boolean
    is_layering: boolean
    is_cap_block: boolean
    is_leaves: int // LEAVES_TYPE
    is_entity: boolean
    is_opaque_for_fluid: boolean
    is_portal: boolean
    is_glass: boolean
    is_grass: boolean
    is_flower: boolean
    is_battery: boolean
    is_log: boolean
    always_waterlogged: boolean
    // boolean values that are automatically calculated by BLOCK, not from JSON
    has_window: boolean
    is_jukebox: boolean
    is_mushroom_block: boolean
    is_sapling: boolean
    is_sign: boolean
    is_banner: boolean
    transmits_light: boolean
    invisible_for_cam: boolean
    invisible_for_rain: boolean
    can_take_shadow: boolean
    is_solid_for_fluid: boolean // вода не течёт, н орендеринг может быть
    can_interact_with_hand: boolean
    can_replace_by_tree: boolean
    drop_if_unlinked: boolean
    visible_for_ao: boolean
    interact_water: boolean
    hide_in_creative: boolean
    can_replace: any
    //
    coocked_item: { count: number, name: string }
    fuel_time: number
    //
    tags: string[]
    rotate: IVector
    width?: float
    height?: float
    depth: float
    light_power: {r: float, g: float, b: float, a: float}
    light_power_number: number
    sound: string
    inventory_icon_id?: number
    max_in_stack: number
    is_powered: boolean
    multiblock?: {x : int, y : int, z : int, w : int, h : int, d : int}
}

interface INetworkMessage<DataT = any> {
    time ?  : number
    name    : int
    data    : DataT
}

interface IDestroyMapsAroundPlayers {
    chunk_render_dist   : int
    chunk_addr          : IVector
}

interface ITerrainMapManager {
    seed:           string
    world_id:       string
    calcBiome(center_coord : IVector, preset : any) : any
}

interface IPickatEventPos extends IVectorPoint {
    mob:        any
    player:     any
    aabb?:      any
    block_id:   int
}

interface IPickatEvent {
    button_id:          number  // always MOUSE.BUTTON_RIGHT === 3
    cloneBlock:         boolean
    createBlock:        boolean
    destroyBlock:       boolean
    id:                 int







    interactMobID?:     int
    interactPlayerID?:  int
    number:             int
    pos:                IPickatEventPos
    shiftKey:           boolean
    start_time:         float
}

// class DirtPalette {
//     x:              int
//     y:              int
//     w:              int
//     h:              int
//     noise_range:    int

//     constructor(x, y, w, h, noise_range) {
//         this.x = x
//         this.y = y
//         this.w = w
//         this.h = h
//         this.noise_range = noise_range
//     }
// }
declare type DirtPalette = {
    x:              int
    y:              int
    w:              int
    h:              int
    noise_range:    int
}

declare type IQuboidInfo = {
    pos1:   IVector
    volume: int
    volx:   int
    voly:   int
    volz:   int
    signx:  int
    signy:  int
    signz:  int
}

declare type IUpdateBlock = {
    pos: IVector
    item: any
    action_id: int
}

declare type IChunkCell = {
    dirt_color: IColor
    water_color: IColor
    biome_id: int
}

declare type IBBModelHideLists = {
    list?: string[],
    except?: string[]
}

declare type IAddMeshArgs = {
    block_pos:          IVector
    model:              string
    hide_groups?:       string[]
    rotate?:            IVector
    animation_name?:    string
    item_block?:        any
    matrix?:            imat4
}

declare type IEnterWorld = {
    options: any,
    world_guid: string
    location: {
        protocol: string,
        hostname: string,
        port?: string,
    }
}