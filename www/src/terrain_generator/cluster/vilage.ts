import {  Vector, VectorCollector} from "../../helpers.js";
import { CLUSTER_PADDING } from "./base.js";
import { VilageSchema } from "./vilage_schema.js";
import { BuildingPalettes } from "./building/palette.js";
import { impl as alea } from '../../../vendors/alea.js';

// Buildings
import { building_classes } from "./building/all.js";
import { ClusterBuildingBase } from "./building_cluster_base.js";

const ROAD_DAMAGE_FACTOR    = 0.15;
const USE_ROAD_AS_GANGWAY   = 0;

// Vilage cluster
export class ClusterVilage extends ClusterBuildingBase {
    [key: string]: any;

    //
    constructor(clusterManager, addr, biome) {

        super(clusterManager, addr);

        this.buildings              = new VectorCollector();
        this.randoms                = new alea(this.id);
        this.use_road_as_gangway    = this.randoms.double() <= USE_ROAD_AS_GANGWAY;

        const bm = this.block_manager

        if(!this.is_empty) {

            this.flat               = this.randoms.double() >= .8;
            this.max_height         = this.flat ? 1 : 30;
            this.wall_block         = this.flat ? bm.STONE_BRICKS.id : bm.OAK_PLANKS.id;
            this.road_block         = this.createBlockPalette([{value: bm.DIRT_PATH, chance: 1}]);
            this.road_block.reset();
            this.basement_block     = this.flat ? bm.POLISHED_ANDESITE.id : bm.COBBLESTONE.id;

            const {schema_options, building_palette_options} = this.initVilageOptions(biome)

            // Building palettes
            this.building_palettes = new BuildingPalettes(this, building_palette_options, bm);

            // Generate vilage schema
            this.timers.start('generate')
            this.schema = new VilageSchema(this, schema_options);
            const resp = this.schema.generate(this.id);
            this.timers.stop()

            //
            this.timers.start('add_buildings')
            this.mask = resp.mask;
            for(let house of resp.house_list.values()) {
                const size = new Vector(house.width, 5, house.depth)
                const entrance = new Vector(house.door.x, Infinity, house.door.z)
                this.addBuilding(this.randoms.double(), house.x, house.z, size, entrance.add(this.coord), house.door.direction, !!house.crossroad)
            }
            this.timers.stop()

        }

        //
        const moving = this.moveToRandomCorner();
        for(let b of this.buildings) {
            b.translate(moving);
        }

    }

    //
    initVilageOptions(biome) {

        const clusterManager = this.clusterManager;

        const schema_options = {
            margin: CLUSTER_PADDING,
            road_damage_factor: ROAD_DAMAGE_FACTOR, // this.flat ? 0 : ROAD_DAMAGE_FACTOR
            size: this.clusterManager.size.x
        }

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
                    {class: 'BuildingBlocks', max_count: Infinity, chance: 1, block_templates: ['streetlight', 'streetlight2', 'streetlight3']}
                ],
                required: [
                    {class: 'BuildingBlocks', max_count: 1, chance: 1, block_templates: ['waterwell', 'waterwell2']},
                    {class: 'Farmland', max_count: 1, chance: 1},
                ],
                others: [
                    {class: 'BuildingBlocks', max_count: 2, chance: .1, block_templates: ['waterwell', 'waterwell2']},
                    {class: 'Farmland',       max_count: Infinity, chance: .2},
                    {class: 'BuildingBlocks', max_count: 1, chance: .25, block_templates: ['church', 'watch_tower']},
                    {class: 'BuildingBlocks', max_count: Infinity, chance: .4, block_templates: ['e3290', 'nico', /*'farmer_house',*/ 'medium_house', 'underearth_tower', 'structure1', 'oak_house_small', 'stone_house_small']},
                    {class: 'BuildingBlocks', max_count: Infinity, chance: .42, block_templates: ['tiny_mart']},
                    {class: 'BuildingBlocks', max_count: Infinity, chance: .7, block_templates: ['domikder', 'domikkam', 'domikkam2'/*, 'sand_house'*/]},
                    // TODO: в конце нужно оставлять самое маленькое по занимаемому размеру участка здание (специфика выборки в BuldingPalette.next)
                    {class: 'BuildingBlocks', max_count: Infinity, chance: 1., block_templates: ['domsmall', 'tiny_house'/*, 'tiny_house2'*/]},
                ]
            };

            if(biome?.building_options) {
                building_palette_options = {...building_palette_options, ...biome?.building_options}
            }

        } else {

            // ширина ячеек между улицами под дома
            schema_options.quant = 14;

            // для старых генераторов (biome2, ...)
            building_palette_options = {
                crossroad: [
                    {class: 'BuildingBlocks', max_count: Infinity, chance: 1, block_templates: ['streetlight', 'streetlight2']}
                ],
                required: [
                    {class: 'BuildingBlocks', max_count: 1, chance: 1, block_templates: ['waterwell', 'waterwell2']},
                    {class: 'Farmland', max_count: 1, chance: 1}
                ],
                others: [
                    {class: 'BuildingBlocks', max_count: 2, chance: .12, block_templates: ['waterwell', 'waterwell2']},
                    {class: 'Farmland', max_count: Infinity, chance: 0.285},
                    {class: 'BuildingBlocks', max_count: Infinity, chance: .7025, block_templates: ['medium_house']},
                    // TODO: в конце нужно оставлять самое маленькое по занимаемому размеру участка здание (специфика выборки в BuldingPalette.next)
                    {class: 'BuildingBlocks', max_count: Infinity, chance: 1, block_templates: ['domsmall']},
                ]
            };

        }

        // Replace class by name
        for(let k in building_palette_options) {
            for(let item of building_palette_options[k]) {
                if (typeof item.class === 'string' || item.class instanceof String) {
                    item.class = building_classes.get(item.class)
                    if(!item.class) {
                        throw 'error_invalid_building_class';
                    }
                }
            }
        }

        return {
            schema_options,
            building_palette_options
        }

    }

}