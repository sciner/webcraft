/**
* https://github.com/PrismarineJS/prismarine-physics
**/

import {Vector} from "../helpers.js";
import {Physics, PrismarinePlayerState} from "./index.js";
import {PLAYER_CONTROL_TYPE, PlayerControl} from "../control/player_control.js";
import {PHYSICS_INTERVAL_MS, PLAYER_HEIGHT, PLAYER_PHYSICS_HALF_WIDTH} from "../constant.js";
import type {PlayerTickData} from "../control/player_tick_data.js";
import type {World} from "../world.js";
import type {Effects} from "../player.js";
import {BlockAccessor} from "../block_accessor.js";
import {ArenaPool} from "./arena_pool.js";
import {AABB} from "./lib/aabb.js";

export const PHYSICS_TIMESTEP = PHYSICS_INTERVAL_MS / 1000;
export const DEFAULT_SLIPPERINESS = 0.6;

/** Исключение, кидаемое физикой, если один из необходимых чанков отсутсвуте/не готов */
const PHYSICS_CHUNK_NOT_READY_EXCEPTION = 'chunk_not_ready'

export type TPrismarineEffects = {
    effects?: Effects[]
}

export type TPrismarineOptions = {
    playerHeight        ? : float
    playerHalfWidth     ? : float
    baseSpeed           ? : float
    stepHeight          ? : float   // how much height can the bot step on without jump
    defaultSlipperiness ? : float
    effects             ? : TPrismarineEffects
    jumpSpeed           ? : float   // вертикальная скорость прыжка. 0 отключает прыжки

    /** If it's defined, the object floats, and this value is its height below the surface. */
    floatSubmergedHeight? : float

    /** Если это определено, то применяется специальный режим вычсления скорости, см. https://minecraft.wiki/w/Boat#Speed */
    useBoatSpeed        ? : boolean

    airborneInertia     ? : float // 0.91 in Minecraft (default), 0.546 in typical old bugged jumps
    airborneAcceleration? : float // 0.02 in Minecraft (default), 0.1 in typical old bugged jumps
}

const tmpPrevPos = new Vector()

export function addDefaultPhysicsOptions(options: TPrismarineOptions) {
    options.playerHeight        ??= PLAYER_HEIGHT
    options.playerHalfWidth     ??= PLAYER_PHYSICS_HALF_WIDTH
    options.baseSpeed           ??= 1 // Базовая скорость (1 для игрока, для мобов меньше или наоборот больше)
    options.stepHeight          ??= 0.65
    options.defaultSlipperiness ??= DEFAULT_SLIPPERINESS
    if (options.floatSubmergedHeight != null) {
        options.floatSubmergedHeight = Math.min(options.floatSubmergedHeight, options.playerHeight * 0.999)
    }
}

export class PhysicsBlock {
    private block_manager: typeof BLOCK
    id      : int

    constructor(block_manager: typeof BLOCK) {
        this.block_manager = block_manager
    }
    
    get material(): IBlockMaterial {
        return this.block_manager.fromId(this.id)
    }
}

export class LiquidBlock {
    position    = new Vector()
    fluid       : int
}

/** Специализированная версия {@link BlockAccessor}, возвращающая данные для физики. */
export class PhysicsBlockAccessor extends BlockAccessor {
    private block_manager   : typeof BLOCK

    // Пулы блоков. Все блоки возвращаются в пул 1 раз перед выполнением физики.
    private blockPool       : ArenaPool<PhysicsBlock>
    private liquidBlockPool = new ArenaPool(LiquidBlock)
    private poolAABB        = new ArenaPool(AABB)

    private static tmpPos = new Vector()

    constructor(world: IWorld) {
        super(world)
        this.block_manager = this.world.block_manager
        this.blockPool = new ArenaPool(PhysicsBlock, this.block_manager)
    }

    reset(initial: IVector): this {
        super.reset(PhysicsBlockAccessor.tmpPos.copyFrom(initial).flooredSelf())
        this.blockPool.reset()
        this.liquidBlockPool.reset()
        this.poolAABB.reset()
        return this
    }

    /** @return блок, если материал не воздух. Иначе - null. Жидкость не учитывает. */
    getBlock(fakeBlock?: PhysicsBlock): PhysicsBlock | null {
        const tblock = this.block
        const id = tblock.id
        if (id < 0) { // если это DUMMY - чанк не готов
            throw PHYSICS_CHUNK_NOT_READY_EXCEPTION
        }
        // если блок совсем пустой
        if (id <= 0) {
            return null
        }
        // заполнить свойства блока
        fakeBlock ??= this.blockPool.alloc()
        fakeBlock.id = id
        return fakeBlock
    }

    /** @return блок, если в нем есть жидкость. Иначе - null. */
    getLiquidBlock(): LiquidBlock | null {
        const fluid = this.block.fluid
        if (!(fluid > 0)) { // эта проверка работает и для DUMMY
            return null
        }
        // заполнить свойства блока
        const res = this.liquidBlockPool.alloc()
        res.fluid = fluid
        this.getPos(res.position)
        return res
    }

    /** Добавляет AABB препятствий к {@link aabbs}. */
    getObstacleAABBs(aabbs: AABB[]): void {
        const tblock = this.block
        const material = this.block.material
        if (material.id <= 0) {
            if (material.id < 0) { // если это DUMMY - чанк не готов
                throw PHYSICS_CHUNK_NOT_READY_EXCEPTION
            }
            return
        }
        /** Проверка что блок - препятствие. Она должна совпадать с проверкой в {@link BLOCK.getShapes} */
        if (!material.passable && !material.planting) {

            // Иммутабельные (?) AABB которые на вернул стиль
            const style = this.block_manager.styles.get(material.style_name)
            const styleAABBs = style.aabb(tblock, true, this.world, false)
            for(const styleAABB of styleAABBs) {
                const aabb = this.poolAABB.alloc()
                    .copyFrom(styleAABB)
                    .translate(this.x, this.y, this.z)
                aabbs.push(aabb)
            }
        }
    }
}

export class PrismarinePlayerControl extends PlayerControl<PrismarinePlayerState> {
    world: World
    backupState = {
        pos: new Vector(),
        vel: new Vector(),
        jumpQueued: false,
        jumpTicks: 0
    }
    physics: Physics;
    private timeAccumulator = 0
    physicsEnabled  = true

    constructor(world: World, pos: Vector, options: TPrismarineOptions) {
        super()
        this.world              = world
        this.physics            = world.physics ??= new Physics(world)
        this.player_state       = new PrismarinePlayerState(pos, options, this.controls);
    }

    get type()              { return PLAYER_CONTROL_TYPE.PRISMARINE }

    get requiresChunk(): boolean { return true }

    get playerHeight(): float       { return this.player_state.options.playerHeight }
    get playerHalfWidth(): float    { return this.player_state.options.playerHalfWidth }

    /** Симулирует необходимое число тиков, если возможно. Используется для предметов, мобов и т.п. */
    tick(deltaSeconds: float): void {
        const pos = this.getPos()
        // check if the chunk is ready (it doesn't guarantee correctness, neighbouring chunk may be missing)
        const chunk = this.world.chunkManager.getByPos(pos)
        if (!chunk?.isReady()) {
            return
        }

        // try tick, and if it throws, restore state and do nothing
        tmpPrevPos.copyFrom(pos)
        this.copyPartialStateFromTo(this.player_state, this.backupState)
        try {
            this.timeAccumulator += deltaSeconds
            while(this.timeAccumulator >= PHYSICS_TIMESTEP) {
                this.timeAccumulator -= PHYSICS_TIMESTEP;
                if (!this.simulatePhysicsTick(false)) {
                    this.copyPartialStateFromTo(this.backupState, this.player_state)
                    break
                }
            }
        } catch (e) {
            this.copyPartialStateFromTo(this.backupState, this.player_state)
            throw e
        }
    }

    resetState(): void {
        super.resetState()
        this.player_state.jumpQueued = false
        this.player_state.jumpTicks = 0
    }

    simulatePhysicsTick(repeated: boolean): boolean {
        if (!this.physicsEnabled) {
            return true
        }
        try {
            this.physics.simulatePlayer(this.simulatedState)
        } catch (e) {
            if (e === PHYSICS_CHUNK_NOT_READY_EXCEPTION) {
                return false
            }
            throw e
        }
        return true
    }

    copyPartialStateFromTo(src: any, dst: any): void {
        dst.pos.copyFrom(src.pos)
        dst.vel.copyFrom(src.vel)
        dst.angularVelocity = src.angularVelocity
        dst.jumpQueued  = src.jumpQueued
        dst.jumpTicks   = src.jumpTicks
        dst.flying      = src.flying
        dst.onGround    = src.onGround
        dst.isInWater   = src.isInWater
        dst.isInLava    = src.isInLava
    }

    validateWithoutSimulation(prevData: PlayerTickData | null, data: PlayerTickData): boolean {
        // TODO implement
        return true
    }
}