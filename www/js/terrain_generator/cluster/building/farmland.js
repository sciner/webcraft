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

        const offset_x = Math.floor((this.size.x - 1) / 2);

        // append basement + natural basement
        this.blocks.appendBasementBlocks(new Vector(-offset_x, 0, 0), this.size, BLOCK.DIRT.id);

    }

    draw(cluster, chunk) {

        // draw blocks
        this.blocks.draw(cluster, chunk);

        //
        cluster.drawQuboid(chunk, this.coord.add(new Vector(0, -1, 0)), this.size.add(new Vector(0, 5, 0)), BLOCK.AIR);
        cluster.drawQuboid(chunk, this.coord.add(new Vector(0, -1, 0)), this.size, BLOCK.OAK_LOG);
        
        const inner_size = this.size.clone().addSelf(new Vector(-2, -1, -2));
        const pos = this.coord.clone().addSelf(new Vector(1, 0, 1));
        cluster.drawQuboid(chunk, pos, inner_size, BLOCK.FARMLAND_WET);

        //
        pos.addSelf(new Vector(0, 1, 0));
        cluster.drawQuboid(chunk, pos, inner_size, this.seeds, null, {stage: 7, complete: true});

        // water
        for(let axe of ['x', 'z']) {
            if(this.size[axe] >= 7) {
                const sz = this.size[axe];
                if((sz - 7) % 3 == 0) {
                    const water_pos = this.coord.clone();
                    const water_size = inner_size.clone();
                    if(axe == 'x') {
                        water_pos.z++;
                        water_size.x = 1;
                    } else {
                        water_pos.x++;
                        water_size.z = 1;
                    }
                    water_size.y = 1;
                    for(let i = 3; i < this.size[axe] - 1; i += 3) {
                        water_pos[axe] += 3;
                        // fix. because water not replace FARMLAND_WET
                        cluster.drawQuboid(chunk, water_pos, water_size, BLOCK.AIR);
                        cluster.drawQuboid(chunk, water_pos, water_size, BLOCK.STILL_WATER);
                        water_pos.y++;
                        cluster.drawQuboid(chunk, water_pos, water_size, BLOCK.AIR);
                        water_pos.y--;
                    }
                    break;
                }
            }
        }

    }

}