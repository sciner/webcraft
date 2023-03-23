/**
* https://github.com/PrismarineJS/prismarine-physics
**/

import {Vec3, Vector} from "../helpers.js";
import {BLOCK} from "../blocks.js";
import {Physics, PlayerState} from "./index.js";
import {Resources} from "../resources.js";
import {FLUID_TYPE_MASK, FLUID_LEVEL_MASK, FLUID_WATER_ID, FLUID_LAVA_ID} from "../fluid/FluidConst.js";
import {TBlock} from "../typed_blocks3.js";
import {PlayerControl} from "../control/player_control.js";
import {PHYSICS_INTERVAL_MS} from "../constant.js";
import {PLAYER_CONTROL_TYPE} from "../control/player_control.js";
import type {PlayerTickData} from "../control/player_tick_data.js";

export const PHYSICS_TIMESTEP = PHYSICS_INTERVAL_MS / 1000;
export const DEFAULT_SLIPPERINESS = 0.6;

// FakeWorld
class FakeWorld {
    static mcData: any;
    world: any;
    block_pos: Vector;
    _pos: Vector;
    _localPos: Vector;
    tblock: TBlock;
    chunkAddr: Vector;

    static getMCData(world) {
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
                seagrass:       null,
                kelp:           null,
                bubble_column:  BLOCK.BUBBLE_COLUMN
            }
        };
        return this.mcData;
    }

    constructor(world) {
        this.world = world;
        this.block_pos = new Vector(0, 0, 0);
        this._pos = new Vector(0, 0, 0);
        this._localPos = new Vector(0, 0, 0);
        this.tblock = new TBlock();
        this.chunkAddr = new Vector(0, 0, 0);
    }

    /**
     * Return block from real world
     * @param {Vector} pos
     * @param {?TBlock} tblock
     *
     * @returns {FakeBlock}
     */
    getBlock(pos, tblock = null) {
        const return_tblock = !!tblock
        const { _pos, _localPos } = this;
        tblock = tblock || this.tblock
        _pos.copyFrom(pos).flooredSelf();
        const chunk = this.world.chunkManager.getChunk(Vector.toChunkAddr(_pos, this.chunkAddr));
        if (!chunk) {
            return new FakeBlock(null, -1, 0, shapesEmpty);
        }
        _localPos.set(_pos.x - chunk.coord.x, _pos.y - chunk.coord.y, _pos.z - chunk.coord.z);
        if(!chunk.tblocks) {
            return null;
        }
        chunk.tblocks.get(_localPos, tblock);
        const id = tblock.id;
        const fluid = tblock.fluid;
        let shapes = tblock.shapes;
        let clonedPos = null;
        if (shapes === null) {
            clonedPos = this._pos.clone();
            shapes = (id > 0) ? BLOCK.getShapes(this._pos, tblock, this.world, true, false) : shapesEmpty;
        }
        if(!return_tblock) tblock = null
        return new FakeBlock(clonedPos, id, fluid, shapes, tblock);
    }
}

const fakeMat = { is_water : false }
const fakeMatWater = { is_water : true }
const fakeProps = {};
const shapesEmpty = [];

export class FakeBlock {
    position: any;
    id: any;
    type: any;
    material: { is_water: boolean; };
    metadata: number;
    shapes: any;
    tblock: any;

    constructor(pos, id, fluid, shapes, tblock?) {
        this.position = pos;
        this.id = this.type = id;
        this.material = fakeMat;
        this.metadata = 0;
        this.shapes = shapes;
        this.tblock = tblock
        if (id === 0 && fluid > 0) {
            const tp = (fluid & FLUID_TYPE_MASK);
            if (tp === FLUID_WATER_ID) {
                this.id = this.type = BLOCK.STILL_WATER.id;
                this.metadata = fluid & FLUID_LEVEL_MASK;
                this.material = fakeMatWater;
            } else if (tp === FLUID_LAVA_ID) {
                this.id = this.type = BLOCK.STILL_LAVA.id;
            }
        }
    }

    getProperties() {
        return fakeProps;
    }
}

// It's used only during initialization
function FakePlayer(pos, effects) {
    return {
        entity: {
            position: pos,
            velocity: new Vec3(0, 0, 0),
            onGround: false,
            isInWater: false,
            isInLava: false,
            isInWeb: false,
            isCollidedHorizontally: false,
            isCollidedVertically: false,
            yaw: 0,
            effects: effects
        },
        jumpTicks: 0,
        jumpQueued: false
    }
}

export class PrismarinePlayerControl extends PlayerControl {
    declare player_state: PlayerState;
    private partialStateBackup = {
        vel: new Vector(),
        jumpQueued: false,
        jumpTicks: 0
    }
    world: FakeWorld;
    physics: any; // { scale: any; gravity: number; flyinGravity: number; flyingYSpeed: number; flyingInertiaMultiplyer: number; airdrag: number; yawSpeed: number; pitchSpeed: number; sprintSpeed: number; sneakSpeed: number; swimDownDrag: { down: number; maxDown: number; }; stepHeight: any; negligeableVelocity: number; soulsandSpeed: number; honeyblockSpeed: number; honeyblockJumpSpeed: number; ladderMaxSpeed: number; ladderClimbSpeed: number; playerHalfWidth: any; playerHeight: any; waterInertia: number; lavaInertia: number; liquidAcceleration: number; airborneInertia: number; airborneAcceleration: number; defaultSlipperiness: any; outOfLiquidImpulse: number; autojumpCooldown: number; bubbleColumnSurfaceDrag: { down: number; maxDown: number; up: number; maxUp: number; }; bubbleColumnDrag: { down: number; maxDown: number; up: number; maxUp: number; }; slowFalling: number; speedEffect: number; slowEffect: number; };
    timeAccumulator: number;
    physicsEnabled: boolean;

    constructor(world, pos: Vector, options) {
        super()
        const mcData            = FakeWorld.getMCData(world);
        this.world              = new FakeWorld(world);
        this.physics            = Physics(mcData, this.world, options);
        const fakePlayer        = FakePlayer(pos, options.effects);
        this.timeAccumulator    = 0;
        this.physicsEnabled     = true;
        this.player_state = new PlayerState(fakePlayer, this.controls, mcData, Resources.physics.features, options.baseSpeed);
    }

    get type()              { return PLAYER_CONTROL_TYPE.PRISMARINE }

    get sneak(): boolean {
        const player_state = this.player_state
        return player_state.control.sneak && player_state.onGround
    }

    get playerHeight(): float { return this.physics.playerHeight }

    // https://github.com/PrismarineJS/mineflayer/blob/436018bde656225edd29d09f6ed6129829c3af42/lib/plugins/physics.js
    tick(deltaSeconds) {
        this.timeAccumulator += deltaSeconds;
        let ticks = 0;
        while(this.timeAccumulator >= PHYSICS_TIMESTEP) {
            if (this.physicsEnabled) {
                this.physics.simulatePlayer(this.player_state, this.world)
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
            this.physics.simulatePlayer(this.player_state, this.world)
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