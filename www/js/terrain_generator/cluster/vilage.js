import { CHUNK_SIZE_X } from "../../chunk_const.js";
import { DIRECTION, getChunkAddr, Vector, VectorCollector} from "../../helpers.js";
import { AABB } from '../../core/AABB.js';
import { ClusterBase, ClusterPoint, CLUSTER_SIZE, CLUSTER_PADDING } from "./base.js";
import { VilageSchema } from "./vilage_schema.js";
import { BUILDING_AABB_MARGIN } from "./building.js";
import { BuildingPalettes } from "./building/palette.js";
import { impl as alea } from '../../../vendors/alea.js';
import { BLOCK } from "../../blocks.js";

// Buildings
import { Farmland } from "./building/farmland.js";
import { WaterWell } from "./building/waterwell.js";
import { StreetLight } from "./building/streetlight.js";
import { BuildingBlocks } from "./building/building_blocks.js";

const ROAD_DAMAGE_FACTOR    = 0.15;
const USE_ROAD_AS_GANGWAY   = 0;

//
const entranceAhead = new Vector(0, 0, 0);
export const getAheadMove = (dir) => {
    entranceAhead.set(0, 0, 0);
    if(dir == DIRECTION.NORTH) {entranceAhead.z++;}
    else if(dir == DIRECTION.SOUTH) {entranceAhead.z--;}
    else if(dir == DIRECTION.EAST) {entranceAhead.x++;}
    else {entranceAhead.x--;}
    return entranceAhead;
}

// Vilage cluster
export class ClusterVilage extends ClusterBase {

    //
    constructor(clusterManager, addr) {

        super(clusterManager, addr);

        this.buildings              = new VectorCollector();
        this.randoms                = new alea(this.id);
        this.use_road_as_gangway    = this.randoms.double() <= USE_ROAD_AS_GANGWAY;
        
        if(!this.is_empty) {

            this.flat               = this.randoms.double() >= .8;
            this.max_height         = this.flat ? 1 : 30;
            this.wall_block         = this.flat ? BLOCK.STONE_BRICKS.id : BLOCK.OAK_PLANKS.id;
            this.road_block         = this.createBlockPalette([{value: BLOCK.DIRT_PATH, chance: 1}]);
            this.road_block.reset();
            this.basement_block     = this.flat ? BLOCK.POLISHED_ANDESITE.id : BLOCK.COBBLESTONE.id;

            //
            this.timers = {
                generate: 0,
                fill_blocks: 0,
                add_buildings: 0,
                fill_blocks_count: 0
            };

            const {schema_options, building_palette_options} = this.initVilageOptions()

            // Building palettes
            this.building_palettes = new BuildingPalettes(this, building_palette_options, BLOCK);

            // Generate vilage schema
            let t = performance.now();
            this.schema = new VilageSchema(this, schema_options);
            const resp = this.schema.generate(this.id);
            this.timers.generate = performance.now() - t;

            //
            t = performance.now();
            this.mask = resp.mask;
            for(let house of resp.houses.values()) {
                const size = new Vector(house.width, 5, house.depth);
                const entrance_pos = new Vector(house.door.x, Infinity, house.door.z);
                const door_bottom = new Vector(house.door.x, Infinity, house.door.z);
                this.addBuilding(this.randoms.double(), house.x, house.z, size, entrance_pos, door_bottom, house.door.direction);
            }
            this.timers.add_buildings = performance.now() - t; t = performance.now();

        }

        //
        const moving = this.moveToRandomCorner();
        for(let b of this.buildings) {
            b.translate(moving);
        }

    }

    //
    initVilageOptions() {

        const clusterManager = this.clusterManager;

        const schema_options = {
            margin: CLUSTER_PADDING,
            road_damage_factor: ROAD_DAMAGE_FACTOR // this.flat ? 0 : ROAD_DAMAGE_FACTOR
        };

        let building_palette_options = {};

        // If generator version == 2
        if(clusterManager.version == 2) {

            // ширина ячеек между улицами под дома
            schema_options.quant = 19;

            // для каждой деревни по каким либо условиям можно генерировать собственный набор домов со своими правилами
            // например взять несколько рандомно разбросанных координат и посмотреть там биомы
            // затем выбрать свою схему для наиболее часто встречаемого биома
            building_palette_options = {
                crossroad: [
                    {class: StreetLight, max_count: Infinity, chance: 1}
                ],
                required: [
                    {class: WaterWell, max_count: 1, chance: 1},
                    {class: Farmland, max_count: 1, chance: 1},
                ],
                others: [
                    {class: WaterWell,      max_count: 2,        chance: .1},
                    {class: Farmland,       max_count: Infinity, chance: .2},
                    {class: BuildingBlocks, max_count: 1, chance: .25, block_templates: ['church', 'watch_tower']},
                    {class: BuildingBlocks, max_count: Infinity, chance: .4, block_templates: ['e3290', 'nico', 'farmer_house', 'medium_house']},
                    {class: BuildingBlocks, max_count: Infinity, chance: .42, block_templates: ['tiny_mart']},
                    {class: BuildingBlocks, max_count: Infinity, chance: .7, block_templates: ['domikder', 'domikkam', 'domikkam2', 'sand_house']},
                    // TODO: в конце нужно оставлять самое маленькое по занимаемому размеру участка здание (специфика выборки в BuldingPalette.next)
                    {class: BuildingBlocks, max_count: Infinity, chance: 1., block_templates: ['domsmall', 'tiny_house', 'tiny_house2']},
                ]
            };

        } else {

            // ширина ячеек между улицами под дома
            schema_options.quant = 14;

            // для старых генераторов (biome2, ...)
            building_palette_options = {
                crossroad: [
                    {class: StreetLight, max_count: Infinity, chance: 1}
                ],
                required: [
                    {class: WaterWell, max_count: 1, chance: 1},
                    {class: Farmland, max_count: 1, chance: 1}
                ],
                others: [
                    {class: WaterWell, max_count: 2, chance: 0.12},
                    {class: Farmland, max_count: Infinity, chance: 0.285},
                    {class: BuildingBlocks, max_count: Infinity, chance: .7025, block_templates: ['medium_house']},
                    // TODO: в конце нужно оставлять самое маленькое по занимаемому размеру участка здание (специфика выборки в BuldingPalette.next)
                    {class: BuildingBlocks, max_count: Infinity, chance: 1, block_templates: ['domsmall']},
                ]
            };

        }

        return {
            schema_options,
            building_palette_options
        }

    }

    /**
     * Add building
     * @param {*} seed 
     * @param {int} dx 
     * @param {int} dz 
     * @param {Vector} size 
     * @param {Vector} entrance 
     * @param {Vector} door_bottom 
     * @param {int} door_direction 
     * @returns 
     */
    addBuilding(seed, dx, dz, size, entrance, door_bottom, door_direction) {

        const coord = new Vector(dx + this.coord.x, 1, dz + this.coord.z);
        if(this.buildings.has(coord)) {
            return false;
        }

        const aabb = new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN)
        const building = this.building_palettes.next(this, seed, door_direction, size, coord.clone(), aabb, entrance.addSelf(this.coord), door_bottom.addSelf(this.coord))

        //
        this.buildings.set(building.coord, building);

        // 1. building mask
        dx = building.coord.x - this.coord.x;
        dz = building.coord.z - this.coord.z;
        for(let i = 0; i < building.size.x; i++) {
            for(let j = 0; j < building.size.z; j++) {
                const x = dx + i;
                const z = dz + j;
                // Draw building basement over heightmap
                this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(building.coord.y, this.basement_block, 3, null, building);
            }
        }

        // 2. entrance mask
        if(building.draw_entrance) {
            let ahead = getAheadMove(building.door_direction);
            const ex = building.entrance.x - this.coord.x + ahead.x;
            const ez = building.entrance.z - this.coord.z + ahead.z;
            this.mask[ez * CLUSTER_SIZE.x + ex] = new ClusterPoint(1, this.basement_block, 3, null, null);
        }

        return true;

    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map, fill_blocks = true, calc_building_y = true) {

        if(this.is_empty) {
            return false;
        }

        let t = performance.now();

        // each all buildings
        for(let b of this.buildings.values()) {

            if(calc_building_y && b.entrance.y == Infinity) {
                b.aabb.y_min = chunk.coord.y - BUILDING_AABB_MARGIN;
                b.aabb.y_max = b.aabb.y_min + b.size.y + BUILDING_AABB_MARGIN * 2;
                if(b.aabb.intersect(chunk.aabb)) {
                    b.findYOld(chunk, maps);
                }
            }
            
            // если строение частично или полностью находится в этом чанке
            if(b.entrance.y != Infinity && b.aabb.intersect(chunk.aabb)) {
                this.drawBulding(chunk, maps, b);
            }
        }

        if(fill_blocks) {
            super.fillBlocks(maps, chunk, map);
        }

        //
        this.timers.fill_blocks += performance.now() - t;
        this.timers.fill_blocks_count++;

    }

    // Draw part of building on map
    drawBulding(chunk, maps, building) {
        const START_X = chunk.coord.x - this.coord.x;
        const START_Z = chunk.coord.z - this.coord.z;
        if(building.hidden) {
            return;
        }
        for(let i = 0; i < building.size.x; i++) {
            let bx = building.coord.x + i;
            // if(bx < chunk.coord.x || bx > chunk.coord.x + chunk.size.x) continue;
            for(let j = 0; j < building.size.z; j++) {
                let bz = building.coord.z + j;
                // if(bz < chunk.coord.z || bz > chunk.coord.z + chunk.size.z) continue;
                const x = bx - chunk.coord.x;
                const z = bz - chunk.coord.z;
                // fix basement height
                const pz = START_Z + z;
                const px = START_X + x;
                if(px >= 0 && pz >= 0 && px < CLUSTER_SIZE.x && pz < CLUSTER_SIZE.z) {
                    let point = this.mask[pz * CLUSTER_SIZE.x + px];
                    if(point && point.height && !point.height_fixed) {
                        // забираем карту того участка, где дверь, чтобы определить точный уровень пола
                        const vec = new Vector(building.coord.x + i, 0, building.coord.z + j);
                        const map_addr = getChunkAddr(vec);
                        let bi = maps.get(map_addr);
                        if(bi) {
                            // if map not smoothed
                            if(!bi.smoothed) {
                                // generate around maps and smooth current
                                bi = maps.generateAround(chunk, map_addr, true, false)[4];
                            }
                            const entrance_x    = vec.x - bi.chunk.coord.x;
                            const entrance_z    = vec.z - bi.chunk.coord.z;
                            const cell          = bi.cells[entrance_z * CHUNK_SIZE_X + entrance_x];
                            if(cell.biome.code == 'BEACH' || cell.biome.code == 'OCEAN') {
                                building.hidden = true;
                            }
                            point.height = Math.max(Math.min(point.height, building.coord.y - cell.value2 + 1), 0);
                            point.height_fixed = true;
                        }
                    }
                }
            }
        }
        // draw building
        if(!building.hidden) {
            building.draw(this, chunk);
        }
    }

}