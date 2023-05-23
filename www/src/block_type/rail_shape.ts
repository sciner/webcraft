import { Vector } from "../helpers.js";
import { BLOCK } from "../blocks.js";
import { BLOCK_ACTION } from "../server_client.js";
import { TBlock } from '../typed_blocks3.js';

export class RailShape {
    [key: string]: any;

    static RAIL_ID          = 26;
    static POWERED_RAIL_ID  = 34;
    static ALL_RAILS        = [RailShape.RAIL_ID, RailShape.POWERED_RAIL_ID];
    static ONLY_STRAIGHT    = [RailShape.POWERED_RAIL_ID]

    static NORTH_SOUTH      = 0;
    static EAST_WEST        = 1;
    static ASCENDING_EAST   = 2;
    static ASCENDING_WEST   = 3;
    static ASCENDING_NORTH  = 4;
    static ASCENDING_SOUTH  = 5;
    static SOUTH_EAST       = 6;
    static SOUTH_WEST       = 7;
    static NORTH_WEST       = 8;
    static NORTH_EAST       = 9;

    static NAMES            = ['NORTH_SOUTH', 'EAST_WEST', 'ASCENDING_EAST', 'ASCENDING_WEST', 'ASCENDING_NORTH', 'ASCENDING_SOUTH', 'SOUTH_EAST', 'SOUTH_WEST', 'NORTH_WEST', 'NORTH_EAST'];
    static STRAIGHT_SIDES   = [RailShape.NORTH_SOUTH, RailShape.EAST_WEST];
    static SIDES            = ['SOUTH', 'EAST', 'NORTH', 'WEST'];
    static OPPOSITES        = {NORTH: 'SOUTH', EAST: 'WEST', SOUTH: 'NORTH', WEST: 'EAST'};
    static TILT_RULES       = {NORTH: RailShape.ASCENDING_NORTH, EAST: RailShape.ASCENDING_EAST, SOUTH: RailShape.ASCENDING_SOUTH, WEST: RailShape.ASCENDING_WEST};
    static TILT             = [RailShape.ASCENDING_EAST, RailShape.ASCENDING_WEST, RailShape.ASCENDING_NORTH, RailShape.ASCENDING_SOUTH];
    static TILT_TO_FLAT     = [RailShape.EAST_WEST, RailShape.EAST_WEST, RailShape.NORTH_SOUTH, RailShape.NORTH_SOUTH];

    // Place rail
    static place(world, pos, new_item, actions) {

        if (!new_item || !RailShape.ALL_RAILS.includes(new_item.id)) {
            return false;
        }

        const tblock        = world.getBlock(pos);
        const BLOCK_CACHE   = Array.from({length: 6}, _ => new TBlock(null, new Vector(0, 0, 0)));
        const neighbours    = tblock.tb.getNeighbours(tblock, null, BLOCK_CACHE);

        if(!neighbours.DOWN || !neighbours.DOWN.material.is_solid) {
            return true;
        }

        // Modify neighbours
        const me_sides = [];
        for(let side of RailShape.SIDES) {
            let n = neighbours[side];
            if(!RailShape.ALL_RAILS.includes(n.id)) n = world.getBlock(n.posworld.add(Vector.YP));
            if(!RailShape.ALL_RAILS.includes(n.id)) n = world.getBlock(n.posworld.add(Vector.YN).addSelf(Vector.YN));
            neighbours[side] = n;
            if(n && RailShape.ALL_RAILS.includes(n.id)) {
                if(RailShape.changeNeighbourShape(world, actions, n, side, n.posworld.sub(tblock.posworld))) {
                    me_sides.push(side);
                    if(me_sides.length == 2) break;
                }
            }
        }

        // Modify me
        const cd = BLOCK.getCardinalDirection(new_item.rotate);
        if(me_sides.length == 0) me_sides.push(RailShape.SIDES[cd]);
        if(me_sides.length == 1) me_sides.push(RailShape.OPPOSITES[me_sides[0]]);
        new_item.extra_data.shape = RailShape.calcShape(me_sides[0], me_sides[1]);
        if(RailShape.ONLY_STRAIGHT.includes(new_item.id)) {
            if(!RailShape.isStraight(new_item.extra_data.shape)) {
                const side1 = RailShape.SIDES[cd]
                const side2 = RailShape.OPPOSITES[side1]
                new_item.extra_data.shape = RailShape[`${side1}_${side2}`] ?? RailShape[`${side2}_${side1}`];
            }
        }

        // Make me tilted
        if(RailShape.isStraight(new_item.extra_data.shape)) {
            const side_name = RailShape.getNameByID(new_item.extra_data.shape);
            // проверяем соседние блоки на "концах" устанавливаемого рельса
            for(let side of side_name.split('_')) {
                const n = neighbours[side];
                // если это рельс и он выше
                if(RailShape.ALL_RAILS.includes(n.id) && n.posworld.y > tblock.posworld.y) {
                    // узнаем его шейп (если он уже модифицирован, то функция вернёт новое значение)
                    const n_shape = RailShape.getModifiedShape(actions, n.posworld, n.extra_data.shape, new_item.id);
                    // вычитываем название "плоской" ориентации полученного шейпа
                    const n_side_name = RailShape.getNameByID(n_shape, true);
                    // если одна из сторон направлена в сторону устанавливаемого рельса
                    if(n_side_name.indexOf(RailShape.OPPOSITES[side]) >= 0) {
                        new_item.extra_data.shape = RailShape.TILT_RULES[side];
                    }
                    break;
                }
            }
        }

        return false;
    }

    static getNameByID(id, flattern = false) {
        const tilt_index = RailShape.TILT.indexOf(id);
        if(flattern && tilt_index >= 0) {
            id = RailShape.TILT_TO_FLAT[tilt_index];
        }
        return RailShape.NAMES[id];
    }

    static isStraight(shape) {
        return RailShape.STRAIGHT_SIDES.indexOf(shape) >= 0;
    }

    /**
     * Возвращает наклонён или нет
     * @param {*} shape 
     * @returns {boolean}
     */
    static isTilted(shape) {
        return RailShape.TILT.indexOf(shape) >= 0;
    }

    static getModifiedShape(actions, pos, def, rail_id) {
        for(let i = 0; i < actions.blocks.list.length; i++) {
            const mod = actions.blocks.list[i];
            if(RailShape.ALL_RAILS.includes(mod.item.id) && mod.pos.equal(pos)) {
                return mod.item.extra_data.shape;
            }
        }
        return def;
    }

    static changeNeighbourShape(world, actions, tblock, side1, pos_diff) {
        const side_name = RailShape.getNameByID(tblock.extra_data.shape, true);
        const cache = Array.from({length: 6}, _ => new TBlock(null, new Vector(0, 0, 0)));
        const neighbours = tblock.tb.getNeighbours(tblock, null, cache);
        let count = 0;
        let side2 = side1;
        for(let side of side_name.split('_')) {
            let n = neighbours[side];
            // если на том же уровне не рельс, смотрим блок выше
            if(!RailShape.ALL_RAILS.includes(n.id)) n = world.getBlock(n.posworld.add(Vector.YP));
            // если блок выше не рельс, то смотрим блок ниже
            if(!RailShape.ALL_RAILS.includes(n.id)) n = world.getBlock(n.posworld.add(Vector.YN).addSelf(Vector.YN));
            if(n && RailShape.ALL_RAILS.includes(n.id)) {
                const n_side_name = RailShape.getNameByID(n.extra_data.shape, true);
                if(n_side_name.indexOf(RailShape.OPPOSITES[side]) < 0) continue;
                if(++count == 2) return null;
                side2 = side;
            }
        }
        // если этот сосед вообще ни с кем не соединен
        if(count == 0) {
            return RailShape.setRailBlockShape(actions, tblock, RailShape.calcShape(RailShape.OPPOSITES[side1], side1, pos_diff));
        } else if(count == 1) {
            if(!RailShape.ONLY_STRAIGHT.includes(tblock.id)) {
                // если у соседа есть только одно сосединение
                if(!RailShape.isTilted(tblock.extra_data.shape)) {
                    return RailShape.setRailBlockShape(actions, tblock, RailShape.calcShape(RailShape.OPPOSITES[side1], side2, pos_diff));
                }
            }
            return RailShape.getNameByID(tblock.extra_data.shape, true).indexOf(RailShape.OPPOSITES[side1]) >= 0;
        }
        return false;
    }

    static calcShape(side1 : string, side2 : string, pos_diff? : Vector) {
        let shape = RailShape[`${side1}_${side2}`] ?? RailShape[`${side2}_${side1}`];
        if(pos_diff && pos_diff.y < 0 && RailShape.isStraight(shape)) {
            if(shape == RailShape.NORTH_SOUTH) {
                shape = pos_diff.z < 0 ? RailShape.ASCENDING_NORTH : RailShape.ASCENDING_SOUTH;
            } else {
                shape = pos_diff.x < 0 ? RailShape.ASCENDING_EAST : RailShape.ASCENDING_WEST;
            }
        }
        return shape;
    }

    static setRailBlockShape(actions, n, shape) {
        actions.addBlocks([{
            pos: n.posworld,
            item: {
                id: n.id,
                extra_data: {shape}
            },
            action_id: BLOCK_ACTION.MODIFY
        }]);
        return true;
    }

}