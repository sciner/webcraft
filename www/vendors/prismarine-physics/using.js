/**
* https://github.com/PrismarineJS/prismarine-physics
**/

import {Vec3, Vector, getChunkAddr} from "../../js/helpers.js";
import {BLOCK} from "../../js/blocks.js";
import {Physics, PlayerState} from "./index.js";
import {Resources} from "../../js/resources.js";
import {FLUID_TYPE_MASK, FLUID_LEVEL_MASK, FLUID_WATER_ID, FLUID_LAVA_ID} from "../../js/fluid/FluidConst.js";
import {TBlock} from "../../js/typed_blocks3.js";

const PHYSICS_INTERVAL_MS   = 50;
export const PHYSICS_TIMESTEP = PHYSICS_INTERVAL_MS / 1000;
export const DEFAULT_SLIPPERINESS = 0.6;

// FakeWorld
class FakeWorld {

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

    // getBlock...
    getBlock(pos) {
        const { _pos, _localPos, tblock } = this;
        _pos.copyFrom(pos).flooredSelf();
        const chunk = this.world.chunkManager.getChunk(getChunkAddr(_pos, this.chunkAddr));
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
        return new FakeBlock(clonedPos, id, fluid, shapes);
    }
}

const fakeMat = { is_water : false }
const fakeMatWater = { is_water : true }
const fakeProps = {};
const shapesEmpty = [];

class FakeBlock {
    constructor(pos, id, fluid, shapes) {
        this.position = pos;
        this.id = this.type = id;
        this.material = fakeMat;
        this.metadata = 0;
        this.shapes = shapes;
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

// FakePlayer
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

export class PrismarinePlayerControl {

    constructor(world, pos, options) {
        const mcData            = FakeWorld.getMCData(world);
        this.world              = new FakeWorld(world);
        this.physics            = Physics(mcData, this.world, options);
        this.player             = FakePlayer(pos,options.effects);
        this.timeAccumulator    = 0;
        this.physicsEnabled     = true;
        this.controls = {
            forward: false,
            back: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
            sneak: false
        };
        this.player_state = new PlayerState(this.player, this.controls, mcData, Resources.physics.features, options.baseSpeed);
    }

    // https://github.com/PrismarineJS/mineflayer/blob/436018bde656225edd29d09f6ed6129829c3af42/lib/plugins/physics.js
    tick(deltaSeconds) {
        this.timeAccumulator += deltaSeconds;
        let ticks = 0;
        while(this.timeAccumulator >= PHYSICS_TIMESTEP) {
            if (this.physicsEnabled) {
                this.physics.simulatePlayer(this.player_state, this.world).apply(this.player);
                // bot.emit('physicsTick')
            }
            // updatePosition(PHYSICS_TIMESTEP);
            this.timeAccumulator -= PHYSICS_TIMESTEP;
            ticks++;
        }
        return ticks;
        // this.physics.simulatePlayer(this.player_state, this.world).apply(this.player);
    }

}