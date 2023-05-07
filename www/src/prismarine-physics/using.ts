/**
* https://github.com/PrismarineJS/prismarine-physics
**/

import {Vector} from "../helpers.js";
import {BLOCK} from "../blocks.js";
import {Physics, PrismarinePlayerState} from "./index.js";
import {TBlock} from "../typed_blocks3.js";
import {PLAYER_CONTROL_TYPE, PlayerControl} from "../control/player_control.js";
import {PHYSICS_INTERVAL_MS, PLAYER_HEIGHT, PLAYER_PHYSICS_HALF_WIDTH} from "../constant.js";
import type {PlayerTickData} from "../control/player_tick_data.js";
import type {World} from "../world.js";
import type {Effects} from "../player.js";

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

    /** Если это определено, то применяется специальный режим вычсления скорости, см. https://minecraft.fandom.com/wiki/Boat#Speed */
    useBoatSpeed        ? : boolean

    airborneInertia     ? : float // 0.91 in Minecraft (default), 0.546 in typical old bugged jumps
    airborneAcceleration? : float // 0.02 in Minecraft (default), 0.1 in typical old bugged jumps
}

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

// FakeWorld
export class FakeWorld {
    world: World;
    block_manager: typeof BLOCK
    block_pos: Vector;
    _pos: Vector;
    _localPos: Vector;
    tblock: TBlock;

    static getMCData(): any {
        return {
            effectsByName: [],
            version: {
                majorVersion: '1.17'
            }
        };
    }

    constructor(world: World) {
        this.world = world;
        this.block_manager = world.block_manager
        this.block_pos = new Vector(0, 0, 0);
        this._pos = new Vector(0, 0, 0);
        this._localPos = new Vector(0, 0, 0);
        this.tblock = new TBlock();
    }

    /**
     * Return block from real world
     * @throws {@link PHYSICS_CHUNK_NOT_READY_EXCEPTION} if the chunk isn't ready
     * TODO return null if air and no liquid (optimization)
     */
    getBlock(pos : Vector, tblock? : TBlock) : FakeBlock | null {
        const return_tblock = !!tblock
        const { _pos, _localPos } = this;
        tblock = tblock || this.tblock
        _pos.copyFrom(pos).flooredSelf();
        const chunk = this.world.chunkManager.getByPos(_pos);
        if (!chunk?.isReady()) {
            // previously new FakeBlock(null, -1, 0, shapesEmpty) on server, null on client
            throw PHYSICS_CHUNK_NOT_READY_EXCEPTION
        }
        _localPos.set(_pos.x - chunk.coord.x, _pos.y - chunk.coord.y, _pos.z - chunk.coord.z);
        chunk.tblocks.get(_localPos, tblock);
        const id = tblock.id;
        const fluid = tblock.fluid;
        let shapes: tupleFloat6[] | null = tblock.shapes // it's always null
        let clonedPos = this._pos.clone();
        if (shapes === null) {
            shapes = (id > 0) ? BLOCK.getShapes(this._pos, tblock, this.world, true, false) : shapesEmpty;
        }
        if(!return_tblock) tblock = null
        return new FakeBlock(clonedPos, id, fluid, shapes, tblock);
    }
}

const shapesEmpty = [];
const tmpPrevPos = new Vector()

export class FakeBlock {
    position: Vector
    id      : int
    fluid   : int
    shapes  : tupleFloat6[]
    tblock? : TBlock

    constructor(pos: Vector, id: int, fluid: int, shapes: tupleFloat6[], tblock?: TBlock) {
        this.position = pos
        this.id = id
        this.shapes = shapes
        this.tblock = tblock
        this.fluid = fluid
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
                if (!this.simulatePhysicsTick()) {
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

    /**
     * Выполняет симуляцию одного физического тика.
     * @param driving - не null если данный игрок является водителем (если участник движения, но не водитель, то
     *   симуляция не должна для него вызываться)
     * @return true если симуляция успешна. Если она не успешна, сосояние неопределено и нуждается в восстановлении,
     *   см. {@link copyPartialStateFromTo}
     *
     * @return true if simulation is successful. If it's not successful, the state is undefined.
     */
    simulatePhysicsTick(): boolean {
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