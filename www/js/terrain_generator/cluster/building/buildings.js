import { AABB } from "../../../core/AABB.js";
import { Building, BUILDING_AABB_MARGIN } from "../building.js";
import { Vec3, Vector } from "../../../helpers.js";
import { impl as alea } from "../../../../vendors/alea.js";
import { BLOCK } from "../../../blocks.js";

// BuildingS (small)
export class BuildingS extends Building {

    static SIZE_LIST = [{x: 5, z: 5, door_pos: {x: 2, z: 2, right: false}}];

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {

        const orig_coord = coord.clone();
        const orig_size = size.clone();

        //
        aabb = new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN);
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        
        // Set materials
        this.materials  = {
            wall:           BLOCK.COBBLESTONE,
            door:           BLOCK.SPRUCE_DOOR,
            wall_corner:    BLOCK.OAK_LOG,
            roof:           BLOCK.OAK_STAIRS,
            roof_block:     BLOCK.OAK_PLANKS,
            light:          BLOCK.TORCH
        };

        //
        this.wallBlocks = this.cluster.createPalette([
            {value: this.materials.wall, chance: .33},
            {value: BLOCK.ANDESITE, chance: .66},
            {value: BLOCK.STONE, chance: 1},
        ]);

        //
        if(orig_size.x > 11 && orig_size.z > 11) {
            // draw fence
            cluster.addFence(orig_coord, orig_size);
            //
            if(this.randoms.double() < .75) {
                const centerOfHay = door_bottom.clone().addByCardinalDirectionSelf(new Vector(-10, 0, 6), door_direction + 2);
                const dx = centerOfHay.x - cluster.coord.x;
                const dz = centerOfHay.z - cluster.coord.z;
                this.addHays(dx, dz);
            }
        }

        // Blocks
        const dir                = this.door_direction;
        const has_crafting_table = this.randoms.double() <= .4;
        const has_chandelier     = this.randoms.double() <= .8;
        const has_bed            = this.randoms.double() <= .6;

        //
        if(this.seed < .7) {
            this.blocks.list.push(...[
                {move: new Vector(0, 0, 3), block_id: BLOCK.SPRUCE_FENCE.id},
                {move: new Vector(0, 1, 3), block_id: BLOCK.SPRUCE_TRAPDOOR.id, extra_data: {opened: false, point: {x: 0, y: 0, z: 0}}},
                {move: new Vector(1, 0, 3), block_id: BLOCK.SPRUCE_STAIRS.id, rotate: {x: (dir + 3) % 4, y: 0, z: 0}}
            ]);
        } else {
            this.blocks.list.push({move: new Vector(1, 0, 3), block_id: BLOCK.SPRUCE_STAIRS.id, rotate: {x: dir, y: 0, z: 0}});
        }
        if(has_crafting_table) {
            this.blocks.list.push({move: new Vector(-1, 0, 1), block_id: BLOCK.CRAFTING_TABLE.id, rotate: {x: dir, y: 0, z: 0}});
        }
        if(has_chandelier) {
            this.blocks.list.push({move: new Vector(0, 3, 2), block_id: BLOCK.LANTERN.id, rotate: {x: 0, y: -1, z: 0}});
        }

        const offset_x = Math.floor((this.size.x - 1) / 2);

        // 4 walls
        this.blocks.append4WallsBlocks(new Vector(-offset_x, 0, 0), this.size, this.wallBlocks);

        // append basement + natural basement
        this.blocks.appendBasementBlocks(new Vector(-offset_x, 0, 0), this.size, this.materials.wall_corner.id ?? this.cluster.basement_block);

        // Bed
        if(has_bed) {
            const bed_block_id = 1210 + ((this.randoms.double() * 4) | 0);
            this.blocks.list.push({move: new Vector(-1, 0, 1), block_id: bed_block_id, rotate: {x: dir + 2, y: -1, z: 0}, extra_data: {is_head: true}});
            this.blocks.list.push({move: new Vector(-1, 0, 2), block_id: bed_block_id, rotate: {x: dir + 2, y: -1, z: 0}});
        }

        // window
        this.blocks.list.push({move: new Vector(-offset_x, 1, offset_x), block_id: BLOCK.GLASS_PANE.id});
        this.blocks.list.push({move: new Vector(offset_x, 1, offset_x), block_id: BLOCK.GLASS_PANE.id});
        this.blocks.list.push({move: new Vector(0, 1, this.size.z - 1), block_id: BLOCK.GLASS_PANE.id});

        // light
        this.blocks.list.push({move: new Vector(0, 2, -1), block_id: this.materials.light.id, rotate: new Vec3(dir, 0, 0)});

        // door
        const door_random = new alea(this.door_bottom.toHash());
        this.blocks.appendDoorBlocks(Vector.ZERO, this.materials.door.id, dir, door_random.double() > .5, true);

        // wall corners
        for(let y = 0; y < this.size.y - 1; y++) {
            this.blocks.list.push({move: new Vector(-offset_x, y, 0), block_id: this.materials.wall_corner.id});
            this.blocks.list.push({move: new Vector(offset_x, y, 0), block_id: this.materials.wall_corner.id});
            this.blocks.list.push({move: new Vector(-offset_x, y, this.size.z - 1), block_id: this.materials.wall_corner.id});
            this.blocks.list.push({move: new Vector(offset_x, y, this.size.z - 1), block_id: this.materials.wall_corner.id});
        }

    }

    //
    draw(cluster, chunk) {

        super.draw(cluster, chunk);

        const dir       = this.door_direction;
        const coord     = this.coord;
        const mat       = this.materials;

        // draw blocks
        this.blocks.draw(cluster, chunk);

        // roof
        this.drawPitchedRoof(chunk, coord, this.size, dir, mat.roof, mat.roof_block, this.wallBlocks);

    }

}