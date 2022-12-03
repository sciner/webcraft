import { BLOCK } from "../../../blocks.js";
import { Vector } from "../../../helpers.js";
import { Building } from "../building.js";

// Farmland
export class Farmland extends Building {

    static SIZE_LIST = Building.makeRandomSizeList([3, 5, 7, 7, 10, 10, 10, 13, 13, 13, 16, 16, 16]);

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        
        size.y = 2;
        
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);

        this.seeds = this.randoms.double() < .5 ? BLOCK.CARROT_SEEDS : BLOCK.WHEAT_SEEDS;
        this.draw_entrance = false;

        const inner_size = this.size.sub(new Vector(2, 0, 2))

        // append basement + natural basement
        this.blocks.appendBasementBlocks(Vector.ZERO, this.size, BLOCK.DIRT.id);

        // add air above
        this.blocks.appendQuboidBlocks(new Vector(0, -1, 0), this.size.add(new Vector(0, 5, 0)), BLOCK.AIR.id)

        // box
        this.blocks.appendQuboidBlocks(new Vector(0, -1, 0), this.size.add(Vector.YP), BLOCK.OAK_LOG.id)

        // farmland wet
        this.blocks.appendQuboidBlocks(new Vector(1, 0, 1), inner_size, BLOCK.FARMLAND_WET.id)

        // seeds
        this.blocks.appendQuboidBlocks(new Vector(1, 1, 1), inner_size, this.seeds.id, {stage: 7, complete: true});

        // water
        for(let axe of ['x', 'z']) {
            if(this.size[axe] >= 7) {
                const sz = this.size[axe];
                if((sz - 7) % 3 == 0) {

                    const water_pos = new Vector(0, 0, 0);
                    const water_size = inner_size.clone();

                    if(axe == 'x') {
                        water_pos.z++;
                        water_size.x = 1;
                    } else {
                        water_pos.x++;
                        water_size.z = 1;
                    }

                    water_size.y = 2;

                    for(let i = 3; i < this.size[axe] - 1; i += 3) {

                        water_pos[axe] += 3;

                        // fix. because water not replace FARMLAND_WET
                        this.blocks.appendQuboidBlocks(water_pos, water_size, BLOCK.AIR.id);
                        this.blocks.appendQuboidBlocks(water_pos, water_size, BLOCK.STILL_WATER.id);

                        // remove seeds under water
                        water_pos.y++;
                        this.blocks.appendQuboidBlocks(water_pos, water_size, BLOCK.AIR.id);
                        water_pos.y--;

                    }

                    break;

                }
            }
        }

    }

    // Draw
    draw(cluster, chunk) {

        super.draw(cluster, chunk);

        this.blocks.draw(cluster, chunk);

    }

}