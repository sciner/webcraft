/**
* https://github.com/PrismarineJS/prismarine-physics
**/

import {Vector} from "../helpers.js";
import {BLOCK} from "../blocks.js";
import {Physics, PlayerState} from "./index.js";
import {TBlock} from "../typed_blocks3.js";
import {PlayerControl} from "../control/player_control.js";
import {PHYSICS_INTERVAL_MS} from "../constant.js";
import {PLAYER_CONTROL_TYPE} from "../control/player_control.js";
import type {PlayerTickData} from "../control/player_tick_data.js";
import type {World} from "../world.js";
import type {Effects} from "../player.js";

export const PHYSICS_TIMESTEP = PHYSICS_INTERVAL_MS / 1000;
export const DEFAULT_SLIPPERINESS = 0.6;

export type TPrismarineEffects = {
    effects?: Effects[]
}

export type TPrismarineOptions = {
    baseSpeed           ? : float   // how much height can the bot step on without jump
    playerHeight        ? : float
    stepHeight          ? : float
    defaultSlipperiness ? : float
    playerHalfWidth     ? : float
    effects             ? : TPrismarineEffects
}

// FakeWorld
export class FakeWorld {
    static mcData: any;
    world: World;
    block_pos: Vector;
    _pos: Vector;
    _localPos: Vector;
    tblock: TBlock;
    chunkAddr: Vector;

    static getMCData(world: World) {
        if(this.mcData) {
            return this.mcData;
        }
        this.mcData = {
            effectsByName: [],
            version: {
                majorVersion: '1.17'
            },
            blocksByName: {
                ice:            BLOCK.ICE,
                packed_ice:     BLOCK.PACKED_ICE, // 2
                air:            BLOCK.AIR,
                frosted_ice:    BLOCK.FROSTED_ICE || BLOCK.ICE, // 3
                blue_ice:       BLOCK.BLUE_ICE, // 3
                soul_sand:      BLOCK.SOUL_SAND,
                cobweb:         [BLOCK.COBWEB, BLOCK.SWEET_BERRY_BUSH],
                water:          [BLOCK.STILL_WATER, BLOCK.FLOWING_WATER],
                lava:           [BLOCK.STILL_LAVA.id, BLOCK.FLOWING_LAVA.id],
                ladder:         BLOCK.LADDER,
                vine:           BLOCK.VINE,
                honey_block:    null,
                seagrass:       BLOCK.SEAGRASS,
                kelp:           BLOCK.KELP,
                bubble_column:  BLOCK.BUBBLE_COLUMN
            }
        };
        return this.mcData;
    }

    constructor(world: World) {
        this.world = world;
        this.block_pos = new Vector(0, 0, 0);
        this._pos = new Vector(0, 0, 0);
        this._localPos = new Vector(0, 0, 0);
        this.tblock = new TBlock();
        this.chunkAddr = new Vector(0, 0, 0);
    }

    /**
     * Return block from real world
     */
    getBlock(pos : Vector, tblock? : TBlock) : FakeBlock | null {
        const return_tblock = !!tblock
        const { _pos, _localPos } = this;
        tblock = tblock || this.tblock
        _pos.copyFrom(pos).flooredSelf();
        const cnunk_manager = this.world.chunkManager
        const chunk = cnunk_manager.getChunk(cnunk_manager.grid.toChunkAddr(_pos, this.chunkAddr));
        if (!chunk || !chunk.isReady()) {
            // previously new FakeBlock(null, -1, 0, shapesEmpty) on server, null on client
            return null
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

export class PrismarinePlayerControl extends PlayerControl {
    declare player_state: PlayerState;
    private partialStateBackup = {
        vel: new Vector(),
        jumpQueued: false,
        jumpTicks: 0
    }
    physics: Physics;
    timeAccumulator: number;
    physicsEnabled: boolean;

    constructor(world: World, pos: Vector, options: TPrismarineOptions) {
        super()
        const mcData            = FakeWorld.getMCData(world);
        this.physics            = world.physics ??= new Physics(mcData, new FakeWorld(world), options);
        this.timeAccumulator    = 0;
        this.physicsEnabled     = true;
        this.player_state       = new PlayerState(pos, options, this.controls);
    }

    get type()              { return PLAYER_CONTROL_TYPE.PRISMARINE }

    get requiresChunk(): boolean { return true }

    get sneak(): boolean {
        const player_state = this.player_state
        return player_state.control.sneak && player_state.onGround
    }

    get playerHeight(): float       { return this.player_state.options.playerHeight }
    get playerHalfWidth(): float    { return this.player_state.options.playerHalfWidth }

    // https://github.com/PrismarineJS/mineflayer/blob/436018bde656225edd29d09f6ed6129829c3af42/lib/plugins/physics.js
    tick(deltaSeconds) {
        this.timeAccumulator += deltaSeconds;
        let ticks = 0;
        while(this.timeAccumulator >= PHYSICS_TIMESTEP) {
            if (this.physicsEnabled) {
                this.physics.simulatePlayer(this.player_state)
                // bot.emit('physicsTick')
            }
            // updatePosition(PHYSICS_TIMESTEP);
            this.timeAccumulator -= PHYSICS_TIMESTEP;
            ticks++;
        }
        return ticks;
        // this.physics.simulatePlayer(this.player_state, this.world).apply(this.player);
    }

    resetState(): void {
        super.resetState()
        this.player_state.jumpQueued = false
        this.player_state.jumpTicks = 0
    }

    backupPartialState(): void {
        this.copyPartialStateFromTo(this.player_state, this.partialStateBackup)
    }

    restorePartialState(pos: Vector): void {
        this.copyPartialStateFromTo(this.partialStateBackup, this.player_state)
        this.player_state.pos.copyFrom(pos)
    }

    simulatePhysicsTick(): void {
        if (this.physicsEnabled) {
            this.physics.simulatePlayer(this.player_state)
        }
    }

    private copyPartialStateFromTo(src: any, dst: any) {
        dst.vel.copyFrom(src.vel)
        dst.jumpQueued  = src.jumpQueued
        dst.jumpTicks   = src.jumpTicks
    }

    validateWithoutSimulation(prevData: PlayerTickData | null, data: PlayerTickData): boolean {
        // TODO implement
        return true
    }
}