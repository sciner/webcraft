// ==========================================
// Physics
//
// This class contains the code that takes care of simulating
// processes like gravity and fluid flow in the world.
// ==========================================

// Creates a new physics simulator.
export default class Physics {
	
    constructor() {
        this.lastStep = -1;
    }

    // Assigns a world to simulate to this physics simulator.
    setWorld(world) {
        this.world = world;
    }

    // Perform one iteration of physics simulation.
    // Should be called about once every second.
    simulate() {
        return;
        let world = this.world;
        let step = Math.floor(new Date().getTime() / 100);
        if(step == this.lastStep) {
            return;
        }
        this.lastStep = step;
        // Gravity
        if (step % 2 == 0) {
            for(let key of Object.keys(world.chunkManager.chunks)) {
                let chunk = world.chunkManager.chunks[key];
                if(!chunk.inited)  {
                    continue;
                }
                for(let pos of chunk.gravity_blocks) {
                    let x = pos.x;
                    let y = pos.y;
                    let z = pos.z;
                    if(y <= 0) {
                        continue;
                    }
                    let block_under = world.chunkManager.getBlock(x, y - 1, z);
                    if([BLOCK.AIR.id, BLOCK.GRASS.id].indexOf(block_under.id) >= 0) {
                        let block = world.chunkManager.getBlock(x, y, z);
                        world.setBlock(x, y - 1, z, block);
                        world.setBlock(x, y, z, BLOCK.AIR);
                    }
                }
            }
        }
        
        /*

        // Fluids
        if (step % 2 == 0) {
            // Newly spawned fluid blocks are stored so that those aren't
            // updated in the same step, creating a simulation avalanche.
            let newFluidBlocks = {};
            for(let key of Object.keys(world.chunkManager.chunks)) {
                let chunk = world.chunkManager.chunks[key];
                if(!chunk.inited)  {
                    continue;
                }
                for(let pos of chunk.fluid_blocks) {
                    let x = pos.x;
                    let y = pos.y;
                    let z = pos.z;
                    let block = world.chunkManager.getBlock(x, y, z);
                    if(block.fluid && block.power) {
                        world.setBlock(x, y, z, BLOCK.fromId(block.fluid.still_block_id), block.power);
                        let underBlock = world.chunkManager.getBlock(x, y, z - 1);
                        let underBlockIsFluid = [
                            BLOCK.STILL_WATER.id,
                            BLOCK.STILL_LAVA.id,
                            BLOCK.FLOWING_WATER.id,
                            BLOCK.FLOWING_LAVA.id
                        ].indexOf(underBlock.id) >= 0;
                        let canFalling = BLOCK.destroyableByWater(underBlock) || underBlockIsFluid;
                        if(canFalling) {
                            world.setBlock(x, y, z - 1, block, block.power);
                            continue;
                        }
                        let candidates = [
                            {x: x - 1, y: y,        z: z},
                            {x: x + 1, y: y,        z: z},
                            {x: x,     y: y - 1,    z: z},
                            {x: x,     y: y + 1,    z: z},
                        ];
                        for(let n of candidates) {
                            for(let zz = -1 ; zz <= 0; zz++) {
                                let b2 = world.chunkManager.getBlock(n.x, n.y, n.z + zz);
                                if(BLOCK.destroyableByWater(b2)) {
                                    world.setBlock(n.x, n.y, n.z + zz, block, block.power - 0.1);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        */

    }

}