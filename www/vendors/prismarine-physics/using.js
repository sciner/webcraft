/**
* https://github.com/PrismarineJS/prismarine-physics
**/

import { Vec3, ROTATE } from "../../js/helpers.js";
import { BLOCK } from "../../js/blocks.js";
import { Physics, PlayerState } from "./index.js";

const PHYSICS_INTERVAL_MS   = 50;
export const PHYSICS_TIMESTEP = PHYSICS_INTERVAL_MS / 1000;

const mcData = {
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
        water:          BLOCK.STILL_WATER,
        lava:           BLOCK.STILL_LAVA,
        ladder:         BLOCK.LADDER,
        vine:           BLOCK.VINES,
        honey_block:    null,
        seagrass:       null,
        kelp:           null,
        bubble_column:  null
    }
};

// FakeWorld
class FakeWorld {

    constructor(world) {
        this.world = world;
    }

    getCardinalDirection(block) {
        return BLOCK.getCardinalDirection(block.rotate).z;
    }

    isOnCeil(block) {
        return block.extra_data && block.extra_data.point.y >= .5; // на верхней части блока (перевернутая ступенька)
    }

    isOpenedTrapdoor(block) {
        return !!(block.extra_data && block.extra_data.opened);
    }

    // getBlock...
    getBlock(pos) {
        pos = pos.floored();
        let b = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        b = {...b};
        if (typeof b.shapes == 'undefined') {
            b.type      = b.id;
            b.metadata  = 0;
            b.position  = pos;
            b.shapes    = [];
            b.getProperties = () => {
                return {
                    waterlogged: false // погружен в воду
                }
            };
            if(!b.passable) {
                switch(b.style) {
                    case 'fence': {
                        let fence_height = 1.35;
                        b.shapes.push([
                            .5-2/16, 0, .5-2/16,
                            .5+2/16, fence_height, .5+2/16
                        ]);
                        //
                        let canConnect = (block) => {
                            return block && (!block.transparent || block.style == 'fence');
                        };
                        let neighbours = {
                            SOUTH: this.world.chunkManager.getBlock(pos.x, pos.y, pos.z - 1),
                            NORTH: this.world.chunkManager.getBlock(pos.x, pos.y, pos.z + 1),
                            WEST: this.world.chunkManager.getBlock(pos.x - 1, pos.y, pos.z),
                            EAST: this.world.chunkManager.getBlock(pos.x + 1, pos.y, pos.z)
                        }
                        this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
                        // South z--
                        if(canConnect(neighbours.SOUTH)) {
                            b.shapes.push([.5-2/16, 0, 0, .5+2/16, fence_height, 5/16]);
                        }
                        // North z++
                        if(canConnect(neighbours.NORTH)) {
                            b.shapes.push([.5-2/16, 0, .5, .5+2/16, fence_height, 1]);
                        }
                        // West x--
                        if(canConnect(neighbours.WEST)) {
                            b.shapes.push([0, 0, .5-2/16, .5, fence_height, .5+2/16]);
                        }
                        // East x++
                        if(canConnect(neighbours.EAST)) {
                            b.shapes.push([.5, 0, .5-2/16, 1, fence_height, .5+2/16]);
                        }
                        break;
                    }
                    case 'pane': {
                        b.cardinal_direction = this.getCardinalDirection(b);
                        // F R B L
                        switch(b.cardinal_direction) {
                            case ROTATE.S: 
                            case ROTATE.N: {
                                b.shapes.push([0, 0, .5-1/16, 1, 1, .5+1/16]);
                                break;
                            }
                            case ROTATE.W:
                            case ROTATE.E: {
                                b.shapes.push([.5-1/16, 0, 0, .5+1/16, 1, 1]);
                                break;
                            }
                        }
                        break;
                    }
                    case 'stairs': {
                        b.cardinal_direction = this.getCardinalDirection(b);
                        b.on_ceil = this.isOnCeil(b);
                        if(b.on_ceil) {
                            b.shapes.push([0, .5, 0, 1, 1, 1]);
    
                        } else {
                            b.shapes.push([0, 0, 0, 1, .5, 1]);
                            // F R B L
                            switch(b.cardinal_direction) {
                                case ROTATE.S: {
                                    b.shapes.push([0, .5, .5, 1, 1, 1]);
                                    break;
                                }
                                case ROTATE.N: {
                                    b.shapes.push([0, .5, 0, 1, 1, .5]);
                                    break;
                                }
                                case ROTATE.W: {
                                    b.shapes.push([.5, .5, 0, 1, 1, 1]);
                                    break;
                                }
                                case ROTATE.E: {
                                    b.shapes.push([0, .5, 0, .5, 1, 1]);
                                    break;
                                }
                            }
                        }
                        break;
                    }
                    case 'trapdoor': {
                        b.cardinal_direction = this.getCardinalDirection(b);
                        b.opened = this.isOpenedTrapdoor(b);
                        b.on_ceil = this.isOnCeil(b);
                        if(b.opened) {
                            // F R B L
                            switch(b.cardinal_direction) {
                                // z--
                                case ROTATE.S: {
                                    b.shapes.push([0, 0, 1-3/16, 1, 1, 1]);
                                    break;
                                }
                                // z++
                                case ROTATE.N: {
                                    b.shapes.push([0, 0, 0, 1, 1, 3/16]);
                                    break;
                                }
                                case ROTATE.W: {
                                    b.shapes.push([1-3/16, 0, 0, 1, 1, 1]);
                                    break;
                                }
                                case ROTATE.E: {
                                    b.shapes.push([0, 0, 0, 3/16, 1, 1]);
                                    break;
                                }
                            }
                        } else {
                            if(b.on_ceil) {
                                b.shapes.push([0, 1-3/16, 0, 1, 1, 1]);
                            } else {
                                b.shapes.push([0, 0, 0, 1, 3/16, 1]);
                            }
                        }
                        break;
                    }
                    case 'slab': {
                        b.on_ceil = this.isOnCeil(b);
                        if(b.on_ceil) {
                            b.shapes.push([0, .5, 0, 1, 1, 1]);
                        } else {
                            b.shapes.push([0, 0, 0, 1, .5, 1]);
                        }
                        break;
                    }
                    default: {
                        b.shapes.push([0, 0, 0, 1, 1, 1]);
                        break;
                    }
                }
            }
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

    constructor(world, pos) {
        this.world              = new FakeWorld(world);
        this.physics            = Physics(mcData, this.world);
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
        this.player_state = new PlayerState(this.player, this.controls, mcData);
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