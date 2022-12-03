import { AABB } from "../../../core/AABB.js";
import { Building, BUILDING_AABB_MARGIN, ROOF_TYPE_FLAT, ROOF_TYPE_PITCHED } from "../building.js";
import { impl as alea } from "../../../../vendors/alea.js";
import { BLOCK } from "../../../blocks.js";
import { Vector } from "../../../helpers.js";

// Building1
export class Building1 extends Building {

    static SIZE_LIST = [
        {x: 7, z: 7, door_pos: {x: 2, z: 2}, right: false},
        {x: 7, z: 7, door_pos: {x: 4, z: 2}, right: true}
    ];

    /**
     * 
     * @param {ClusterBase} cluster 
     * @param {float} seed 
     * @param {Vector} coord 
     * @param {AABB} aabb 
     * @param {Vector} entrance 
     * @param {Vector} door_bottom 
     * @param {Vector} door_direction 
     * @param {Vector} area_size 
     */
    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, area_size, random_size) {

        const orig_coord = coord.clone();
        const orig_size = area_size.clone();

        //
        aabb = new AABB().set(0, 0, 0, area_size.x, area_size.y, area_size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN);
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, area_size);

        const is_right           = !!random_size?.right;
        const x_sign             = is_right ? -1 : 1;

        this.is_big_building = orig_size.x > 11 && orig_size.z > 11;
        this.roof_type = ROOF_TYPE_PITCHED;
        this.random_size = random_size;
        this.x_sign = x_sign;

        //
        this.selectMaterials();

        //
        this.wallBlocks = this.cluster.createPalette([
            {value: this.materials.wall, chance: 1}
        ]);

        // Blocks
        const dir                = this.door_direction;
        const add_hays           = this.randoms.double() <= .75;
        const has_crafting_table = this.randoms.double() <= .4;
        const has_chandelier     = this.randoms.double() <= .8;
        const has_chest          = this.randoms.double() <= .5;
        const has_bed            = this.randoms.double() <= .6;
        const has_bookshelfs     = this.randoms.double();
        const mat                = this.materials;

        //
        if(this.is_big_building) {
            // draw fence
            cluster.addFence(orig_coord, orig_size, door_bottom, this.blocks.list);
            //
            if(add_hays) {
                const centerOfHay = door_bottom.clone().addByCardinalDirectionSelf(new Vector(-11, 0, 6), door_direction + 2);
                const dx = centerOfHay.x - cluster.coord.x;
                const dz = centerOfHay.z - cluster.coord.z;
                this.addHays(dx, dz);
            }
        }

        const offset_x = is_right ? -4 : -2;

        // 4 walls
        this.blocks.append4WallsBlocks(new Vector(offset_x, 0, 0), this.size, this.wallBlocks);

        // append basement + natural basement
        this.blocks.appendBasementBlocks(new Vector(offset_x, 0, 0), this.size, this.materials.wall_corner?.id ?? this.cluster.basement_block);

        if(has_chest) {
            this.blocks.list.push({
                move: new Vector(-1 * x_sign, 3, 5),
                block_id: BLOCK.CHEST.id,
                rotate: {x: (dir + 1 + (random_size?.right ? 2 : 0)) % 4, y: 1, z: 0},
                extra_data: {generate: true, params: {source: 'village_house'}}
            });
        }

        // Bed
        if(has_bed) {
            const color_index = ((this.randoms.double() * 4) | 0);
            const bed_block_id = 1210 + color_index;
            const carpet_block_id = 810 + color_index;
            this.blocks.list.push({move: new Vector(1 * x_sign, 0, 5), block_id: bed_block_id, rotate: {x: (dir + 1) % 4, y: -1, z: 0}, extra_data: {is_head: !is_right}});
            this.blocks.list.push({move: new Vector(2 * x_sign, 0, 5), block_id: bed_block_id, rotate: {x: (dir + 1) % 4, y: -1, z: 0}, extra_data: {is_head: is_right}});
            this.blocks.list.push({move: new Vector(1 * x_sign /*+ (is_right ? 0 : 1)*/, 0, 4), block_id: carpet_block_id, rotate: {x: 0, y: 1, z: 0}});
        }

        // Book cases
        if(has_bookshelfs < .6) {
            let bc_start_pos = null;
            if(has_bookshelfs < .2) {
                bc_start_pos = new Vector(3 * x_sign, 0, 4);
            } else if(has_bookshelfs < .4) {
                bc_start_pos = new Vector(-1 * x_sign, 0, 1);
            }
            if(bc_start_pos) {
                this.blocks.list.push({move: bc_start_pos.add(new Vector(0, 0, 0)), block_id: BLOCK.BOOKSHELF.id});
                this.blocks.list.push({move: bc_start_pos.add(new Vector(0, 0, 1)), block_id: BLOCK.BOOKSHELF.id});
                this.blocks.list.push({move: bc_start_pos.add(new Vector(0, 1, 0)), block_id: BLOCK.BOOKSHELF.id});
                this.blocks.list.push({move: bc_start_pos.add(new Vector(0, 1, 1)), block_id: BLOCK.BOOKSHELF.id});
            }
        }

        // Front window
        this.blocks.list.push({move: new Vector(2 * x_sign, 1, 0), block_id: BLOCK.GLASS_PANE.id, rotate: new Vector(dir, 0, 0)});

        // Back windows
        this.blocks.list.push({move: new Vector(0 * x_sign, 1, random_size.z - 1), block_id: BLOCK.GLASS_PANE.id, rotate: new Vector(dir, 0, 0)});
        this.blocks.list.push({move: new Vector(2 * x_sign, 1, random_size.z - 1), block_id: BLOCK.GLASS_PANE.id, rotate: new Vector(dir, 0, 0)});

        // Light
        if(mat.light) {
            if(mat.light.id == BLOCK.LANTERN.id) {
                this.blocks.list.push({move: new Vector(1 * x_sign, 4, -1), block_id: BLOCK.LANTERN.id, rotate: new Vector(0, -1, 0)});
            } else {
                this.blocks.list.push({move: new Vector(1 * x_sign, 1, -1), block_id: mat.light.id, rotate: new Vector(dir, 0, 0)});
            }
        }

        // door
        const door_random = new alea(this.door_bottom.toHash());
        this.blocks.appendDoorBlocks(Vector.ZERO, this.materials.door.id, dir, door_random.double() > .5, true);

    }

    //
    draw(cluster, chunk) {

        const dir       = this.door_direction;
        const coord     = this.coord;
        const mat       = this.materials;

        //
        const bx = coord.x - chunk.coord.x;
        const by = coord.y - chunk.coord.y;
        const bz = coord.z - chunk.coord.z;

        // npc
        const npc_pos = new Vector(bx + Math.round(this.size.x/2) + chunk.coord.x, by + chunk.coord.y, bz + Math.round(this.size.z/2) + chunk.coord.z);
        cluster.addNPC(chunk, npc_pos);

        // draw blocks
        this.blocks.draw(cluster, chunk);

        // roof
        switch(this.roof_type) {
            case ROOF_TYPE_PITCHED: {
                this.drawPitchedRoof(chunk, coord, this.size, dir, mat.roof, mat.roof_block, this.wallBlocks);
                break;
            }
            case ROOF_TYPE_FLAT: {
                this.drawFlatRoof(chunk, coord, this.size, dir, mat.roof);
            }
        }

    }

    selectMaterials() {
        const {cluster, seed} = this;
        //
        if(cluster.flat) {
            if(seed < .5) {
                this.materials  = {
                    wall: BLOCK.STONE_BRICKS,
                    door: BLOCK.SPRUCE_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANKS,
                    light: BLOCK.LANTERN
                };
            } else {
                this.materials  = {
                    wall: BLOCK.BRICKS,
                    door: BLOCK.DARK_OAK_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANKS,
                    light: BLOCK.LANTERN
                };
            }
        } else {
            if(seed < .5) {
                this.materials  = {
                    wall: BLOCK.OAK_PLANKS,
                    door: BLOCK.OAK_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANKS,
                    light: BLOCK.TORCH
                };
            } else {
                this.materials  = {
                    wall: BLOCK.OAK_PLANKS,
                    door: BLOCK.OAK_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANKS,
                    light: BLOCK.TORCH
                };
            }
        }
    }

    addSecondFloor() {

        const dir = this.door_direction;
        const x_sign = this.x_sign;

        const modX = (x) => {
            return x * x_sign
        }

        this.blocks.list.push(...[
            {move: new Vector(modX(-1), 2, 5), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(modX(-1), 2, 4), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(modX(0), 2, 5), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(modX(0), 2, 4), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(modX(1), 2, 5), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(modX(1), 2, 4), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(modX(2), 2, 5), block_id: BLOCK.SPRUCE_SLAB.id, extra_data: {point: {x: 0, y: 0, z: 0}}},
            {move: new Vector(modX(2), 2, 4), block_id: BLOCK.SPRUCE_SLAB.id, extra_data: {point: {x: 0, y: 0, z: 0}}},
            {move: new Vector(modX(3), 2, 5), block_id: BLOCK.SPRUCE_SLAB.id, extra_data: {point: {x: 0, y: 0, z: 0}}},
            {move: new Vector(modX(3), 2, 4), block_id: BLOCK.SPRUCE_SLAB.id, extra_data: {point: {x: 0, y: 0, z: 0}}},
            {move: new Vector(modX(2), 1, 3), block_id: BLOCK.SPRUCE_STAIRS.id, rotate: new Vector(dir, 0, 0)},
            {move: new Vector(modX(2), 0, 2), block_id: BLOCK.SPRUCE_STAIRS.id, rotate: new Vector(dir, 0, 0)},
            {move: new Vector(modX(-1), 3, 4), block_id: BLOCK.OAK_FENCE.id},
            {move: new Vector(modX(0), 3, 4), block_id: BLOCK.OAK_FENCE.id},
            {move: new Vector(modX(1), 3, 4), block_id: BLOCK.OAK_FENCE.id},
        ]);

    }

    setBiome(biome, temperature, humidity) {
        super.setBiome(biome, temperature, humidity);
        // this.selectMaterials();
        if(['Заснеженный пляж', 'Пустыня'].includes(biome.title)) {
            this.materials = {...this.materials,
                wall: BLOCK.SANDSTONE,
                // door: BLOCK.SPRUCE_DOOR,
                roof: BLOCK.CUT_SANDSTONE,
                roof_block: BLOCK.CUT_SANDSTONE,
                light: null
            };
            this.wallBlocks = this.cluster.createPalette([
                {value: this.materials.wall, chance: 1}
            ]);
            this.roof_type = ROOF_TYPE_FLAT;
            this.size.y--;
        } else {
            this.addSecondFloor();
        }
    }

}