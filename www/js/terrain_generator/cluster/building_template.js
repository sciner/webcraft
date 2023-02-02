import { FLUID_LAVA_ID, FLUID_WATER_ID } from "../../fluid/FluidConst.js";
import { Vector, VectorCollector, SimpleShiftedMatrix } from "../../helpers.js";

const BLOCKS_CAN_BE_FLOOR = [468]; // DIRT_PATH

const DELETE_BLOCK_ID = 199; // this block is automatically removed from the templates

// By how many blocks postprocessing can increase the template size
const MAX_EXTEND_TEMPLATE_FRONT = 2;
const MAX_EXTEND_TEMPLATE_SIDE = 1;
// The radius of "air craters" adeed around the porch tiles. It can be fractional.
const PORCH_CRATER_RADIUS = 2;
// Up to this radius, the floor of the air crater is flat. Starting from this radius,
// the height starts to increase. To avoid blocking entrances near the roofs, it shuld
// be at least 1.
const PORCH_FLAT_CRATER_RADIUS = 1;
const PORCH_MAX_HALF_WIDTH = 1;
const PORCH_CRATER_HEIGHT = 8;

//
export class BuildingTemplate {

    static schemas = new Map();
    static known_templates = new Map()

    constructor(json, bm) {

        if(!json) debugger
        if(!bm) debugger

        for(let prop of ['name', 'world', 'meta', 'size', 'door_pos', 'blocks', 'fluids']) {
            if(prop in json) {
                switch(prop) {
                    case 'door_pos':
                    case 'size': {
                        this[prop] = new Vector(json[prop])
                        break
                    }
                    default: {
                        this[prop] = json[prop]
                    }
                }
            }
        }

        if(this.blocks) {
            this.rot = [ [], [], [], [] ]
            const {all_blocks} = this.prepareBlocks(bm)
            this.rotateBuildingBlockVariants(bm, all_blocks)
            this.prepareFluids()
        }

    }

    getMeta(name, default_value) {
        const meta = this.meta
        if(name in meta) {
            return meta[name]
        }
        return default_value
    }

    static addSchema(schema, bm) {
        schema.world.pos1 = new Vector(schema.world.pos1)
        schema.world.pos2 = new Vector(schema.world.pos2)
        schema.world.entrance = new Vector(schema.world.entrance)
        schema.door_pos = new Vector(schema.door_pos)
        schema.size = new Vector(schema.size)
        this.schemas.set(schema.name, schema);
        // precompile
        if(bm) {
            this.fromSchema(schema.name, bm)
        }
    }

    /**
     * @param {string} name 
     * @param {*} bm 
     * @returns 
     */
    static fromSchema(name, bm) {
        let template = BuildingTemplate.known_templates.get(name)
        if(template) {
            return template
        }
        template = new BuildingTemplate(this.getSchema(name), bm)
        BuildingTemplate.known_templates.set(name, template)
        return template
    }

    static getSchema(name) {
        const resp = this.schemas.get(name)
        if(!resp) {
            debugger
            throw `building_schema_not_found|${name}`
        }
        return resp
    }

    /**
     * Create rotated variants
     * @param {*} bm 
     */
    prepareBlocks(bm) {

        const all_blocks = new VectorCollector()
        const min = new Vector(Infinity, Infinity, Infinity)

        // Auto fill by air
        if('y' in this.size) {

            for(let block of this.blocks) {
                if(block.move.x < min.x) min.x = block.move.x
                if(block.move.y < min.y) min.y = block.move.y
                if(block.move.z < min.z) min.z = block.move.z
            }

            if(min.y != Infinity) {

                if(this.getMeta('air_column_from_basement', true)) {

                    const two2map = new VectorCollector()

                    // building a 2D floor map of the building
                    for(let block of this.blocks) {
                        if(block.move.y - min.y < 2) {
                            const b = bm.fromId(block.block_id);
                            // не учитываем неполные блоки у основания строения в качестве пола
                            if(b.is_solid || BLOCKS_CAN_BE_FLOOR.includes(b.id)) {
                                two2map.set(new Vector(block.move.x, 0, block.move.z), true);
                            }
                        }
                    }

                    // по 2D карте пола здания строим вертикальные столбы воздуха
                    // ставим блоки воздуха там, где они нужны, внутри здания, чтобы местность не занимала эти блоки
                    for(const [vec, _] of two2map.entries()) {
                        for(let y = 0; y < this.size.y; y++) {
                            const air_pos = new Vector(vec.x, min.y + y, vec.z)
                            all_blocks.set(air_pos, {block_id: 0, move: air_pos})
                        }
                    }

                }

            }

        }

        // add all blocks from the schema
        for(let block of this.blocks) {
            // remove air blocks from the schematic
            if(block.block_id > 0) {
                block.mat = bm.fromId(block.block_id)
                if(block.mat.chest) {
                    const type = block.extra_data?.type ?? null
                    block.extra_data = {slots: {}}
                    if(type) {
                        block.extra_data.type = type
                    }
                }
                all_blocks.set(block.move, block)
            }
        }

        // filling the "insides" of the building with air
        if(!this.getMeta('air_column_from_basement', true)) {
            this._fillAir(bm, all_blocks, min)
        }

        // mark blocks on the "shell" of the building, which can be replaced with terrain blocks
        if('y' in this.size && min.y != Infinity) {
            this._markReplacebleBlocks(bm, all_blocks, min)
        }

        // Fill chest extra_data
        const CHEST_ID = bm.CHEST.id;
        for(const [pos, block] of all_blocks.entries()) {
            if(block.block_id == DELETE_BLOCK_ID) {
                all_blocks.delete(pos)
            } else if(block.block_id == CHEST_ID) {
                if(!block.extra_data) block.extra_data = {};
                block.extra_data = {...block.extra_data, generate: true, params: {source: 'building'}}
            }
        }

        // Add cap dirt block
        this.createBiomeDirtCapBlocks(all_blocks, min, bm)

        // Call it only after DELETE_BLOCK_ID is deleted
        // TODO: Этот код предназначался для создания пустоты перед дверью,
        // чтобы дверь не заваливало блоками земли,
        // но однако он также модифицирует размер строения, этого нельзя делать,
        // т.к. от этого зависит фундамент и расчеты позиции строения
        // this.addAirMargins(all_blocks, min, bm)

        return {all_blocks, min}

    }

    prepareFluids() {
        const fluids = this.fluids
        if(!fluids || fluids.length == 0) {
            return false
        }
        const directions = [0, 1, 2, 3]
        for(let i = 0; i < fluids.length; i += 4) {
            // TODO: Need to detect flowing fluids too 
            const fluid_id = fluids[i + 3]
            let block_id = 0
            if(fluid_id & FLUID_WATER_ID) block_id = 200
            if(fluid_id & FLUID_LAVA_ID) block_id = 170
            const block = {
                block_id: block_id,
                move: new Vector(
                    fluids[i + 0],
                    fluids[i + 1],
                    fluids[i + 2]
                )
            }
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                this.rot[direction].push(block);
            }
        }
    }

    /**
     * Create rotated variants
     * @param {*} bm 
     */
    rotateBuildingBlockVariants(bm, all_blocks) {

        // Rotate property
        BuildingTemplate.rotateBlocksProperty(all_blocks, this.rot, bm, [0, 1, 2, 3]);

    }

    createBiomeDirtCapBlocks(all_blocks, min, bm) {
        const move = new Vector(0, 0, 0)
        const block_id = 69
        const mat = bm.fromId(block_id)
        for(let x = 0; x < this.size.x; x++) {
            for(let z = 0; z < this.size.z; z++) {
                for(let y = this.size.y; y > 0; y--) {
                    move.copyFrom(min).addScalarSelf(x, y - 1, z)
                    const block = all_blocks.get(move)
                    if(block && block.block_id > 0) {
                        if(block.mat?.is_solid) {
                            //if(move.y >= 80) {
                                move.y++
                                all_blocks.set(move, {block_id, mat, move: move.clone(), candidate_for_cap_block: true})
                            //}
                        }
                        break
                    }
                }
            }
        }
    }

    _markReplacebleBlocks(bm, all_blocks, min) {

        const _vec = new Vector(0, 0, 0)

        const markAsCheckSolid = (pos) => {
            const block = all_blocks.get(pos)
            if(block && block.block_id > 0) {
                if(!block.mat.is_solid && !['bed', 'door'].includes(block.mat.style_name)) {
                    // если это не сплошной, то разрешаем его заменять сплошным блоком ландшафта
                    // (если такой будет на этой позиции)
                    block.check_is_solid = true
                }
                return true
            }
            return false;
        }

        for(let y = 0; y < this.size.y; y++) {
            for(let x = 0; x < this.size.x; x++) {
                // от двери назад
                for(let z = 0; z < this.size.z; z++) {
                    _vec.set(x, y, z).addSelf(min)
                    if(markAsCheckSolid(_vec)) break
                }
                // сзади к двери
                for(let z = this.size.z - 1; z >= 0; z--) {
                    _vec.set(x, y, z).addSelf(min)
                    if(markAsCheckSolid(_vec)) break
                }
            }
            //
            for(let z = 0; z < this.size.z; z++) {
                // слева направо
                for(let x = 0; x < this.size.x; x++) {
                    _vec.set(x, y, z).addSelf(min)
                    if(markAsCheckSolid(_vec)) break
                }
                // справо налево
                for(let x = this.size.x - 1; x >= 0; x--) {
                    _vec.set(x, y, z).addSelf(min)
                    if(markAsCheckSolid(_vec)) break
                }
            }
        }

    }

    // Заполнение "внутренностей" постройки воздухом
    _fillAir(bm, all_blocks, min) {

        const _vec = new Vector(0, 0, 0)
        const air_block_id = 0
        const air_block_mat = bm.fromId(air_block_id)
        const stopper_block = {block_id: -1}

        for(let y = 0; y < this.size.y; y++) {

            for(let x = 0; x < this.size.x; x++) {

                // от двери назад
                let inside = false
                for(let z = 0; z < this.size.z; z++) {
                    _vec.set(x, y, z).addSelf(min)
                    const block = all_blocks.get(_vec)
                    if(block && block.block_id > 0) {
                        inside = true
                    }
                    if(!block) {
                        if(inside) {
                            all_blocks.set(_vec, {block_id: air_block_id, move: _vec.clone(), mat: air_block_mat})
                        } else {
                            all_blocks.set(_vec, stopper_block)
                        }
                    }
                }

                // сзади к двери
                for(let z = this.size.z - 1; z >= 0; z--) {
                    _vec.set(x, y, z).addSelf(min)
                    const block = all_blocks.get(_vec)
                    if(block && block.block_id > 0) {
                        break
                    }
                    // all_blocks.delete(_vec)
                    all_blocks.set(_vec, stopper_block)
                }

            }

            //
            for(let z = 0; z < this.size.z; z++) {

                let inside = false

                // слева направо
                for(let x = 0; x < this.size.x; x++) {
                    _vec.set(x, y, z).addSelf(min)
                    const block = all_blocks.get(_vec)
                    if(block && block.block_id > 0 && block.block_id != stopper_block.block_id) {
                        inside = true
                    }
                    if(inside) {
                        if(!block) {
                            all_blocks.set(_vec, {block_id: air_block_id, move: _vec.clone(), mat: air_block_mat})
                        }
                    } else {
                        if(!block || block.block_id == 0) {
                            all_blocks.delete(_vec)
                            // all_blocks.set(_vec, stopper_block)
                        }
                    }
                }

                // справо налево
                for(let x = this.size.x - 1; x >= 0; x--) {
                    _vec.set(x, y, z).addSelf(min)
                    const block = all_blocks.get(_vec)
                    if(block && block.block_id > 0 && block.block_id != stopper_block.block_id) {
                        break
                    }
                    all_blocks.delete(_vec)
                }

            }

        }

        for(const [pos, block] of all_blocks.entries()) {
            if(block.block_id == stopper_block.block_id) {
                all_blocks.delete(pos)
            }
        }

    }

    // Detects the porch around the door. Adds crater-like air margins around the porch.
    // Removes check_is_solid above the porch.
    // Increases the template size if necessary.
    addAirMargins(all_blocks, min, bm) {

        function recFindPorch(x, prevFloorY, z) {
            if (// don't search for a porch there
                z >= door_pos.z || x < door_pos.x - PORCH_MAX_HALF_WIDTH ||
                x > door_pos.x + PORCH_MAX_HALF_WIDTH ||
                // if we have already visited it
                porch.getOrDefault(x, z, true)
            ) {
                return;
            }
            tmpVec.setScalar(x, prevFloorY, z);
            porchMin.minSelf(tmpVec);
            porchMax.maxSelf(tmpVec);

            // Find the floor height. It must be at the same height as the 
            // previous position, or 1 block below it
            for(let i = 0; i < 3; i++) {
                if (tmpVec.y < min.y) {
                    break;
                }
                let mat = all_blocks.get(tmpVec)?.mat;
                if (mat?.is_solid) {
                    break;
                }
                tmpVec.y--;
            }
            const floorY = ++tmpVec.y;
            if (floorY > prevFloorY || floorY < prevFloorY - 1) {
                // don't mark it yet, we may enter it from another side
                return;
            }

            // find the impassable ceiling
            for(tmpVec.y++; tmpVec.y <= max.y; tmpVec.y++) {
                let mat = all_blocks.get(tmpVec)?.mat;
                if (mat && !mat.passable) {
                    break;
                }
            }
            if (// if the ceiling is too low, it's not a porch.
                tmpVec.y < floorY + 2 ||
                // or it's actually a porch, but without a ceiling it's irrelevant
                tmpVec.y > max.y
            ) {
                porch.set(x, z, { porch: false });
                return;
            }
            
            // The porch has a ceiling. Ensure that there are at least 2 air blocks above.
            porch.set(x, z, {
                porch: true,
                y: Math.min(tmpVec.y - 2, door_pos.y)
            });
            recFindPorch(x - 1, floorY, z);
            recFindPorch(x + 1, floorY, z);
            recFindPorch(x, floorY, z - 1);
            recFindPorch(x, floorY, z + 1);
        }

        if (!this.door_pos || min.x == Infinity) {
            return;
        }
        const door_pos = new Vector(this.door_pos).addSelf(min);
        const tmpVec = new Vector();
        const max = min.clone().addSelf(this.size).addScalarSelf(-1, -1, -1);

        // find the porch floor below a ceiling
        const porchMin = door_pos.clone();
        const porchMax = door_pos.clone();
        const intCraterRadius = Math.floor(PORCH_CRATER_RADIUS + 0.001);
        const porch = new SimpleShiftedMatrix(
            min.x - MAX_EXTEND_TEMPLATE_SIDE,
            min.z - MAX_EXTEND_TEMPLATE_FRONT,
            this.size.x + 2 * MAX_EXTEND_TEMPLATE_SIDE,
            this.size.z + MAX_EXTEND_TEMPLATE_FRONT);
        porch.set(door_pos.x, door_pos.z, {
            porch: true,
            y: door_pos.y
        });
        recFindPorch(door_pos.x, door_pos.y, door_pos.z - 1);

        // find the air craters floor around the porch
        const newMin = min.clone();
        const newMax = max.clone();
        for(let [px, pz, p] of porch.entries()) {
            if (!p?.porch) {
                continue;
            }
            // for each block around the porch block
            for (let dx = -intCraterRadius; dx <= intCraterRadius; dx++) {
                const x = px + dx;
                if (!porch.hasRow(x)) {
                    continue;
                }
                for (let dz = -intCraterRadius; dz <= intCraterRadius; dz++) {
                    const z = pz + dz;
                    if (z >= door_pos.z || !porch.hasCol(z)) {
                        continue;
                    }
                    let r = Math.sqrt(dx * dx + dz * dz);
                    if (r > PORCH_CRATER_RADIUS) {
                        continue;
                    }
                    const floorY = Math.round(p.y + Math.max(0, r - PORCH_FLAT_CRATER_RADIUS));
                    tmpVec.setScalar(x, floorY, z);
                    newMin.minSelf(tmpVec);
                    newMax.maxSelf(tmpVec);
                    let column = porch.get(tmpVec.x, tmpVec.z);
                    if (column == null) {
                        column = { porch: false };
                        porch.set(tmpVec.x, tmpVec.z, column);
                    }
                    column.craterY = Math.min(column.craterY ?? Infinity, floorY);
                }
            }
        }

        // draw the craters
        let maxY = Math.min(door_pos.y + PORCH_CRATER_HEIGHT, max.y);
        for(let [x, z, p] of porch.entries()) {
            if (p?.craterY == null) {
                continue;
            }
            tmpVec.setScalar(x, p.craterY, z);
            for(; tmpVec.y <= maxY; tmpVec.y++) {
                let block = all_blocks.getOrSet(tmpVec, (vec) => {
                    return {block_id: 0, move: vec.clone()};
                });
                delete block.check_is_solid;
            }
        }

        // expand the template
        this.size.x += (min.x - newMin.x) + (newMax.x - max.x);
        this.size.z += (min.z - newMin.z) + (newMax.z - max.z);
        this.door_pos = Vector.vectorify(this.door_pos)
            .addScalarSelf(min.x - newMin.x, 0, min.x - newMin.x);
    }

    /**
     * @param {VectorCollector} all_blocks 
     * @param {[][]} rot 
     * @param {*} bm 
     * @param {int[]} directions 
     */
    static rotateBlocksProperty(all_blocks, rot, bm, directions) {

        const ROT_N = [18, 22, 7, 13];
    
        //
        const rot_none = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                rot[direction].push(block);
            }
        };

        //
        const rot1 = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                const rb = JSON.parse(JSON.stringify(block));
                if(rb.rotate) {
                    if(rb.rotate.y == 0) {
                        rb.rotate.x = ROT_N[(ROT_N.indexOf(rb.rotate.x) + direction) % 4];
                    } else {
                        rb.rotate.x = (rb.rotate.x + direction) % 4;
                    }
                }
                rot[direction].push(rb);
            }
        }

        //
        const rotate_x = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                const rb = JSON.parse(JSON.stringify(block));
                rb.rotate.x = (rb.rotate.x + direction) % 4;
                rot[direction].push(rb);
            }
        }

        //
        const rot3 = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                const rb = JSON.parse(JSON.stringify(block));
                rb.rotate.x = (rb.rotate.x + direction + 2) % 4;
                rot[direction].push(rb);
            }
        }

        //
        const rot4 = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i]
                const rb = JSON.parse(JSON.stringify(block))
                if(rb.rotate.y == 0) {
                    rb.rotate.x = (rb.rotate.x + direction + 4) % 4
                } else {
                    rb.rotate.x = (rb.rotate.x - direction + 4) % 4
                }
                rot[direction].push(rb)
            }
        }

        const rotx8 = (block) => {
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i];
                const rb = JSON.parse(JSON.stringify(block));
                rb.rotate.x = (rb.rotate.x - direction * 90) % 360;
                rot[direction].push(rb);
            }
        }

        const rot_rails = (block) => {
            const rot_sides = [
                [5, 2, 4, 3],
                [0, 1, 0, 1],
                [9, 8, 7, 6],
            ];
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i]
                const rb = JSON.parse(JSON.stringify(block))
                let new_shape = 0
                rb.extra_data = rb.extra_data ?? {}
                if('shape' in rb.extra_data) {
                    const shape = rb.extra_data.shape
                    for(let i = 0; i < rot_sides.length; i++) {
                        const rot_row = rot_sides[i]
                        let index = rot_row.indexOf(shape)
                        if(index >= 0) {
                            new_shape = rot_row[(index + direction) % rot_row.length]
                        }
                    }
                }
                rb.extra_data.shape = new_shape
                rot[direction].push(rb)
            }
        }

        const rot_cover = (block) => {
            // TODO: Strange sides order, but working correct
            const sides = ['north', 'west', 'south', 'east']
            for(let i = 0; i < directions.length; i++) {
                const direction = directions[i]
                const rb = JSON.parse(JSON.stringify(block))
                if(block.extra_data) {
                    rb.extra_data = {}
                    for(let k in block.extra_data) {
                        switch(k) {
                            case 'east':
                            case 'west':
                            case 'north':
                            case 'south': {
                                const new_index = sides.indexOf(k) + direction
                                const new_side_name = sides[new_index % sides.length]
                                rb.extra_data[new_side_name] = block.extra_data[k]
                                break
                            }
                            default: {
                                rb.extra_data[k] = JSON.parse(JSON.stringify(block.extra_data[k]))
                            }
                        }
                    }
                } else if (block.rotate) {
                    rb.rotate.x = (rb.rotate.x + direction) % 4
                }
                rot[direction].push(rb)
            }
        }

        for(const [_, block] of all_blocks.entries()) {

            // если это воздух, то просто прописываем его во все измерения
            if(block.block_id == 0) {
                rot_none(block);
                continue
            }

            // получаем материал
            const mat = block.mat ?? bm.fromId(block.block_id);
            if(block.mat) {
                delete(block.mat);
            }

            if(['bed'].includes(mat.style_name)) {
                rotate_x(block)

            } else if(mat.tags.includes('stairs') || mat.tags.includes('ladder') || mat.tags.includes('trapdoor') || ['banner', 'campfire', 'anvil', 'lantern', 'torch', 'door', 'chest', 'lectern', 'fence_gate'].includes(mat.style_name)) {
                rotate_x(block)

            } else if(['cover'].includes(mat.style_name)) {
                rot_cover(block)

            } else if(mat.tags.includes('rotate_x8')) {
                rotx8(block)

            } else if(['sign'].includes(mat.style_name)) {
                rot4(block)

            } else if(mat.tags.includes('rotate_by_pos_n')) {
                rot1(block)

            } else if(['armor_stand'].includes(mat.style_name)) {
                rot3(block)

            } else if(['rails'].includes(mat.style_name)) {
                rot_rails(block)

            } else if(mat.can_rotate && block.rotate) {
                rotate_x(block)

            } else {
                rot_none(block)

            }

        }

    }

}