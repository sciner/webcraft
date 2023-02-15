// Physics simulator.
export class Physics {
    [key: string]: any;

    constructor(world) {
        this.lastStep = -1;
        // Assigns a world to simulate to this physics simulator.
        this.world = world;
    }

    init() {

    }

    // Perform one iteration of physics simulation.
    // Should be called about once every second.
    simulate() {
        return false;
        // Защита от большого FPS (максимум 10 раз в секунду)
        let step = Math.floor(new Date().getTime() / 100);
        if(step == this.lastStep) {
            return;
        }
        //
        let world = this.world;
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
                    if(y <= 1) {
                        continue;
                    }
                    let block_under = world.chunkManager.getBlock(x, y - 1, z);
                    if([BLOCK.AIR.id, BLOCK.GRASS.id].indexOf(block_under.id) >= 0) {
                        let block = world.chunkManager.getBlock(x, y, z);
                        world.chunkManager.setBlock(x, y - 1, z, block);
                        world.chunkManager.setBlock(x, y, z, BLOCK.AIR);
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
                        (x, y, z, BLOCK.fromId(block.fluid.still_block_id), block.power);
                        let underBlock = world.chunkManager.getBlock(x, y, z - 1);
                        let underBlockIsFluid = [
                            BLOCK.STILL_WATER.id,
                            BLOCK.STILL_LAVA.id,
                            BLOCK.FLOWING_WATER.id,
                            BLOCK.FLOWING_LAVA.id
                        ].indexOf(underBlock.id) >= 0;
                        let canFalling = BLOCK.destroyableByWater(underBlock) || underBlockIsFluid;
                        if(canFalling) {
                            world.chunkManager.setBlock(x, y, z - 1, block, true, block.power);
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
                                    world.chunkManager.setBlock(n.x, n.y, n.z + zz, block, true, block.power - 0.1);
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