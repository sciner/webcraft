/**
* https://github.com/PrismarineJS/prismarine-physics
**/

import {Vec3} from "../../js/helpers.js";
import {BLOCK} from "../../js/blocks.js";
import {Physics, PlayerState} from "./index.js";
import {Resources} from "../../js/resources.js";

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
                packed_ice:     BLOCK.ICE2,
                air:            BLOCK.AIR,
                frosted_ice:    BLOCK.ICE3,
                blue_ice:       BLOCK.ICE3,
                soul_sand:      BLOCK.SOUL_SAND,
                cobweb:         BLOCK.COBWEB,
                water:          [BLOCK.STILL_WATER, BLOCK.FLOWING_WATER],
                lava:           [BLOCK.STILL_LAVA.id, BLOCK.FLOWING_LAVA.id],
                ladder:         BLOCK.LADDER,
                vine:           BLOCK.VINES,
                honey_block:    null,
                seagrass:       null,
                kelp:           null,
                bubble_column:  null
            }
        };
        return this.mcData;
    }

    constructor(world) {
        this.world = world;
    }

    // getBlock...
    getBlock(pos) {
        pos = pos.floored();
        let b = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        if (b.shapes === null) {
            b.position = pos;
            b.shapes = (b.id > 0) ? BLOCK.getShapes(pos, b, this.world, true, false) : [];
        }
        return b;
    }

}

// FakePlayer
function FakePlayer(pos) {
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
            yaw: 0
        },
        jumpTicks: 0,
        jumpQueued: false
    }
}

export class PrismarinePlayerControl {

    constructor(world, pos, default_speed, playerHeight, stepHeight, defaultSlipperiness) {
        const mcData            = FakeWorld.getMCData(world);
        this.world              = new FakeWorld(world);
        this.physics            = Physics(mcData, this.world, playerHeight, stepHeight, defaultSlipperiness);
        this.player             = FakePlayer(pos);
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
        this.player_state = new PlayerState(this.player, this.controls, mcData, Resources.physics.features, default_speed);
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