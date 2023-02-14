import {impl as alea} from '../../../vendors/alea.js';
import {ClusterPoint} from './base.js';
import {DIRECTION, Vector, VectorCollector} from "../../helpers.js";

let randoms = new Array(1024);
let a = new alea('random_road_damage');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Dev sandbox
const DIR_HOR = 0;
const DIR_VER = 1;

export class VilageSchema {
    [key: string]: any;

    constructor(cluster, settings = {}) {
        this.cluster = cluster;
        this.fill_house_map = false;
        this.fill_house_door_path = false;
        if(!settings) {
            settings = {};
        }
        this.settings = {
            size:               128,
            road_dist:          2,
            margin:             8,
            quant:              12,
            init_depth:         2,
            road_margin:        1,
            house_margin:       5,
            road_ext_value:     2, // Это значение расширения дороги, 0 = один пиксель
            house_intencity:    0.2,
            road_damage_factor: 0,
            ...settings
        };
    }

    generate(seed) {
        this.randoms            = new alea(seed);
        this.crossroads         = new VectorCollector();
        this.mask               = new Array(this.settings.size * this.settings.size);
        this.cell_map           = [];
        this.cb_cell_map        = [];
        this.complex_buildings  = new Map();
        this.house_list         = new Map();
        const center_x_corr = Math.floor(this.randoms.double() * 20 - 10);
        const center_z_corr = Math.floor(this.randoms.double() * 20 - 10);
        this.push_branch((this.settings.size / 2) + center_x_corr, (this.settings.size / 2) + center_z_corr, DIR_HOR, this.settings.init_depth);
        this.push_branch((this.settings.size / 2) + center_x_corr, (this.settings.size / 2) + center_z_corr, DIR_VER, this.settings.init_depth);
        for(let cb_building of this.complex_buildings.values()) {
            // if it does not intersect with existing complex_building, then we send it to the map
            let house = this.put_building_complex(cb_building.x, cb_building.z, cb_building.cell_count_x, cb_building.cell_count_z, cb_building.path_dir);
            if(house !== null) {
                this.house_list.set(cb_building.z * this.settings.size + cb_building.x, house);
            }
        }
        //
        const light_point = new ClusterPoint(1, 69, 3, null)
        // crossroad buildings
        for(let [vec, cr] of this.crossroads.entries()) {
            if(cr.cnt > 1) {
                if(this.fill_house_map) {
                    this.mask[vec.z * this.settings.size + vec.x] = light_point;
                }
                const house = {
                    x:          vec.x - 1,
                    z:          vec.z - 1,
                    width:      3,
                    depth:      3,
                    crossroad:  true,
                    door:       {x: vec.x, z: vec.z, direction: DIRECTION.NORTH}
                };
                this.house_list.set(vec.z * this.settings.size + vec.x, house);
            }
        }
        //
        return {
            mask: this.mask,
            house_list: this.house_list
        }
    }

    // Add crossroad point
    addCrossRoad(x, z) {
        let vec = new Vector(x, 0, z);
        let cr = this.crossroads.get(vec);
        if(cr) {
            cr.cnt++;
            return;
        }
        this.crossroads.set(vec, {cnt: 1});
    }

    //
    isDamagedRoad() {
        if(!this.settings.road_damage_factor) {
            return false;
        }
        if(!this.damage_road_index) {
            this.damage_road_index = 0;
        }
        const r = randoms[this.damage_road_index++ % randoms.length];
        return r <= this.settings.road_damage_factor;
    }

    push_branch(x : int, z : int, axis : int, depth : int) {
        // One random per branch
        let branch_rnd = this.randoms.double();
        const settings = this.settings;
        let ln = (depth + 1) * settings.quant + 25;
        const is_x_mod = axis === DIR_HOR ? 1 : 0;
        const is_z_mod = axis === DIR_VER ? 1 : 0;
        var rnd = branch_rnd;
        rnd = rnd > .25 ? rnd : .25;
        rnd = rnd > .75 ? .75 : rnd;
        const pre_part = Math.floor(rnd * ln / settings.quant) * settings.quant;
        const post_part = Math.floor((ln - pre_part) / settings.quant) * settings.quant;
        // const road_point = new ClusterPoint(1, this.cluster.road_block, 5, null);
        this.addCrossRoad(x - (pre_part) * is_x_mod + 1, z - (pre_part) * is_z_mod + 1);
        this.addCrossRoad(x - (pre_part - post_part) * is_x_mod + 1, z - (pre_part - post_part) * is_z_mod + 1);
        for(var process = 0; process <= (pre_part + post_part) + settings.road_ext_value; process++) {
            let xprint = x - (pre_part - process) * is_x_mod;
            let zprint = z - (pre_part - process) * is_z_mod;
            if(xprint >= settings.margin
                && xprint < (settings.size - settings.margin)
                && zprint >= settings.margin
                && zprint < (settings.size - settings.margin)
            ) {
                // fill road blocks
                for(let road_step = 0; road_step <= settings.road_ext_value; road_step++) {
                    if(this.isDamagedRoad()) {
                        continue;
                    }
                    const dx = (xprint + (road_step * is_z_mod));
                    const dz = (zprint + (road_step * is_x_mod));
                    // this.mask[dz * settings.size + dx] = road_point;
                    this.mask[dz * settings.size + dx] = new ClusterPoint(1, this.cluster.road_block.next().id, 5, null)
                }
            }
        }
        // Installation of houses along the line
        // Number of cells for buildings in pre_part and post_part
        const positions = [Math.floor(pre_part / settings.quant), Math.floor(post_part / settings.quant)];
        for(let dir in positions) {
            let sign = dir === '1' ? 1 : -1;
            for(let i = 0; i < positions[dir]; i++) {
                // Right or Left
                let side_mod = (branch_rnd * (i + 7)) % 1 > .5 ? 1 : -1; // left
                // House on the right side of the line
                let q_mod = sign === -1 ? settings.quant : 0;
                let house_cell_x = x + (sign * settings.quant * i - q_mod) * is_x_mod;
                let house_cell_z = z + (sign * settings.quant * i - q_mod) * is_z_mod;
                if(side_mod < 0) {
                    if(axis === DIR_HOR) {
                        house_cell_z -= settings.quant;
                    } else {
                        house_cell_x -= settings.quant;
                    }
                }
                let building_rnd = this.randoms.double(); // (branch_rnd * house_cell_z * house_cell_x) % 1;
                if(building_rnd < settings.house_intencity || building_rnd > (1-settings.house_intencity)) {
                    let house = this.put_building(house_cell_x, house_cell_z);
                    if (house !== null) {
                        // Калькуляция точки начала и направления. Тропа всегда идет от дороги к двери
                        let dot_pos_x = house_cell_x, dot_pos_z = house_cell_z;
                        if (axis === DIR_HOR) {
                            dot_pos_x += Math.round(settings.quant / 2 + settings.road_ext_value / 2);
                            dot_pos_z += side_mod > 0 ? settings.road_ext_value : settings.quant;
                        } else {
                            dot_pos_x += side_mod > 0 ? settings.road_ext_value : settings.quant;
                            dot_pos_z += Math.round(settings.quant / 2 + settings.road_ext_value / 2);
                        }
                        // Add house to the registry by coordinate
                        house.door = this.putPathToDoor(dot_pos_x, dot_pos_z, axis === DIR_VER ? side_mod : 0, axis === DIR_HOR ? side_mod : 0);
                        this.house_list.set(house_cell_z * settings.size + house_cell_x, house);
                    }
                }
            }
            // Иногда делаем сложный дом затирая 2-4 ячейки, тут нам известно с какой стороны рисовать тропу к дому
            // Сложные дома справа, поэтому тропинки либо слева направо, либо сверху вниз,
            // Для разнообразия карту можно вращать
            const cb_random_param = (1 - settings.house_intencity);
            if(branch_rnd > cb_random_param && positions[dir] > 1) {
                this.complex_buildings.set(z * settings.size + x, {
                    x: x,
                    z: z,
                    cell_count_x: is_x_mod ? 2 : branch_rnd > cb_random_param ? 2 : 1,
                    cell_count_z: is_z_mod ? 2 : branch_rnd < (1 - cb_random_param) ? 2 : 1,
                    path_dir: axis === DIR_HOR ? 'up' : 'left'
                });
            }
        }
        // Installation of houses along the road line
        const next_dir = axis === DIR_VER ? DIR_HOR : DIR_VER;
        if(depth > 0) {
            let inc_amount = 0;
            if(post_part >= settings.quant) {
                inc_amount = settings.quant * Math.floor(post_part / settings.quant);
                // let new_branch_rnd = this.randoms.double(); // ((x + (inc_amount * is_x_mod)) * (z + (settings.quant * is_z_mod)) / 1000) % 1;
                this.push_branch(x + (inc_amount * is_x_mod), z + (settings.quant * is_z_mod), next_dir, depth - 1) //, new_branch_rnd);
            }
            if(pre_part >= settings.quant) {
                inc_amount = settings.quant * Math.floor(pre_part / settings.quant);
                this.push_branch(x - (inc_amount * is_x_mod), z - (settings.quant * is_z_mod), next_dir, depth - 1) //, branch_rnd);
            }
        }
    }

    // Make road to door and return door object
    putPathToDoor(x, z, x_dir, z_dir) {
        let xprint = x, zprint = z, dest = this.settings.road_dist;
        for(var process = 0; process < dest; process++) {
            if(this.fill_house_door_path) {
                this.put_dot(xprint, zprint, process == dest - 1 ? this.cluster.basement_block : this.cluster.road_block.next().id, 1, this.settings.road_margin);
            }
            xprint += x_dir;
            zprint += z_dir;
        }
        let door = {
            x:          x_dir === 0 ? x : x + dest * x_dir,
            z:          z_dir === 0 ? z : z + dest * z_dir,
            direction:  this.get_door_front_direction(x_dir, z_dir),
        }
        return door;
    }

    // Returns the coordinate of the door and its direction
    get_door_front_direction(x_dir, z_dir) {
        return x_dir === 0 ? (z_dir < 0 ? DIRECTION.SOUTH : DIRECTION.NORTH) : (x_dir < 0 ?  DIRECTION.WEST : DIRECTION.EAST)
    }

    put_building(x, z) {
        const settings = this.settings;
        let key = z * settings.size + x;
        if(this.cell_map[key] !== undefined) {
            return null;
        }
        this.cell_map[key] = 1;
        // Road margins
        x += settings.road_dist;
        z += settings.road_dist;
        let x_size = settings.quant - settings.road_dist * 2 - settings.road_ext_value;
        let z_size = x_size;
        // Проверка удаленности дома от границы кластера
        if(x >= settings.margin
            && (x + x_size) < (settings.size - settings.margin)
            && z >= settings.margin
            && (z + z_size) < (settings.size - settings.margin)
        ) {
            let house = {
                x:      x + settings.road_ext_value,
                z:      z + settings.road_ext_value,
                width:  x_size + 1,
                depth:  z_size + 1,
                door:   null
            };
            // Drawing house perimeter
            if(this.fill_house_map) {
                for(var i = 0; i < house.width; i++) {
                    for(var j = 0; j < house.depth; j++) {
                        this.mask[(house.z + j) * settings.size + (house.x + i)] = new ClusterPoint(1, this.cluster.basement_block, this.settings.house_margin, null);
                    }
                }
            }
            return house;
        } else {
            return null;
        }
    }

    put_dot(x, z, block_id, height, margin) {
        const settings = this.settings;
        if(x >= settings.margin
            && x < (settings.size - settings.margin)
            && z >= settings.margin
            && z < (settings.size - settings.margin)
        ) {
            this.mask[z * settings.size + x] = new ClusterPoint(height, block_id, margin ? margin: 5, null);
            return true;
        } else {
            return false;
        }
    }

    put_building_complex(x, z, cell_count_x, cell_count_z, path_dir) {
        // Настройки
        const settings = this.settings;
        // Начальные параметры
        const x_init = x;
        const z_init = z;
        // Проверяем на непересечение с другими complex_building, для обозначения cell берется стартовая координата ячейки
        let local_cb_cell_map = [];
        for (var cell_x = 0; cell_x < cell_count_x; cell_x++) {
            for (var cell_z = 0; cell_z < cell_count_z; cell_z++) {
                let tmp_x = x + (cell_x * settings.quant);
                let tmp_z = z + (cell_z * settings.quant);
                let key = tmp_z * settings.size + tmp_x;
                local_cb_cell_map[key] = 1;
            }
        }
        for(let lcm_key in local_cb_cell_map) {
            if(this.cb_cell_map[lcm_key] !== undefined) {
                return null;
            } else {
                this.cb_cell_map[lcm_key] = 1;
            }
        }
        // Отступы от дорог
        x += settings.road_dist + settings.road_ext_value;
        z += settings.road_dist + settings.road_ext_value;
        let x_size = settings.quant * cell_count_x - settings.road_dist * 2 + 1 - settings.road_ext_value;
        let z_size = settings.quant * cell_count_z - settings.road_dist * 2 + 1 - settings.road_ext_value;
        // Проверка удаленности дома от границы кластера
        if(x >= settings.margin
            && (x + x_size) < (settings.size - settings.margin)
            && (z) >= settings.margin
            && (z + z_size) < (settings.size - settings.margin)
        ) {
            // Зачистка территории под сложный дом
            for (let i = settings.road_ext_value + 1; i < cell_count_x * settings.quant; i++) {
                for (let j = settings.road_ext_value + 1; j < cell_count_z * settings.quant; j++) {
                    this.mask[(z_init + j) * settings.size + (x_init + i)] = null;
                }
            }
            // Отрисовка площадки под дом на карте
            if(this.fill_house_map) {
                for(let i = 0; i < x_size; i++) {
                    for(let j = 0; j < z_size; j++) {
                        this.mask[(z + j) * settings.size + (x + i)] = new ClusterPoint(1, this.cluster.basement_block, this.settings.house_margin);
                    }
                }
            }
            for(let x_cursor = 0; x_cursor <= settings.quant * cell_count_x + settings.road_ext_value; x_cursor++) {
                for(let road_step = 0; road_step < 1 + settings.road_ext_value; road_step++) {
                    if(this.isDamagedRoad()) {
                        continue;
                    }
                    this.put_dot((x_init + x_cursor), (z_init + settings.quant * cell_count_z + road_step), this.cluster.road_block.next().id, 1, this.settings.road_margin);
                }
            }
            // Отрисовка дороги вокруг сложного дома для обеспечения соединенности всех дорог
            for(let x_cursor = 0; x_cursor <= settings.quant * cell_count_x + settings.road_ext_value; x_cursor++) {
                for(let road_step = 0; road_step < 1 + settings.road_ext_value; road_step++) {
                    if(this.isDamagedRoad()) {
                        continue;
                    }
                    this.put_dot((x_init + x_cursor), (z_init + settings.quant * cell_count_z + road_step), this.cluster.road_block.next().id, 1, this.settings.road_margin);
                    this.put_dot((x_init + x_cursor), (z_init + road_step), this.cluster.road_block.next().id, 1, this.settings.road_margin);
                }
            }
            for (let z_cursor = 0; z_cursor <= settings.quant * cell_count_z + settings.road_ext_value; z_cursor++) {
                for (let road_step = 0; road_step < 1 + settings.road_ext_value; road_step++) {
                    if(this.isDamagedRoad()) {
                        continue;
                    }
                    this.put_dot((x_init + road_step), (z_init + z_cursor), this.cluster.road_block.next().id, 1, this.settings.road_margin);
                    this.put_dot((x_init + road_step + settings.quant * cell_count_x), (z_init + z_cursor), this.cluster.road_block.next().id, 1, this.settings.road_margin);
                }
            }
            // Отрисовка тропинки
            let path_x = x_init;
            let path_z = z_init;
            if(path_dir === 'up') {
                path_x = x_init + (cell_count_x * settings.quant) / 2;
                path_z += settings.road_ext_value;
            } else {
                path_x += settings.road_ext_value;
                path_z = z_init + (cell_count_z * settings.quant) / 2;
            }
            // Затираем обычные дома под сложным домом
            for(let i = x_init; i < x_init + (settings.quant * cell_count_x); i += settings.quant) {
                for(let j = z_init; j < z_init + (settings.quant * cell_count_z); j += settings.quant) {
                    if(this.house_list.has(j * settings.size + i)) {
                        this.house_list.delete(j * settings.size + i);
                    }
                }
            }
            // Возвращаем дом
            let house = {
                x:      x,
                z:      z,
                width:  x_size,
                depth:  z_size,
                door:   this.putPathToDoor(path_x, path_z, path_dir === 'up' ? 0 : 1, path_dir === 'up' ? 1 : 0),
            };
            return house;
        } else {
            return null;
        }
    }

}