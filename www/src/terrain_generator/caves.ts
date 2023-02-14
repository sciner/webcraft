import {impl as alea} from '../../vendors/alea.js';
import {Vector, SpiralGenerator, VectorCollector} from "../helpers.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE} from "../chunk_const.js";
import {AABB} from '../core/AABB.js';

// Общее количество блоков в чанке
const DIVIDER                   = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
const CHUNK_DIAGONAL_LENGTH     = Vector.ZERO.distance(DIVIDER);
const MAX_RAD                   = 2; // максимальный радиус секции
const TREASURE_ROOM_RAD         = 3.5;
const GROUP_COUNT               = 8;
const MAX_DIR_LENGTH            = 25;
const CAVES_SERCH_MARGIN        = 8;
const CAVES_MAX_LENGTH          = CAVES_SERCH_MARGIN * CHUNK_SIZE_X - (MAX_RAD + 1) * 2;
const _aabb                     = new AABB();
const _intersection             = new Vector(0, 0, 0);
const temp_vec                  = new Vector(0, 0, 0);
const vec_line                  = new Vector(0, 0, 0);
const new_pos                   = new Vector(0, 0, 0);
const _vec_chunk_start          = new Vector(0, 0, 0); // Адрес чанка, где начинается отрезок
const _vec_chunk_end            = new Vector(0, 0, 0); // Адрес чанка, где заканчивается отрезок
const _vec_chunk_coord          = new Vector(0, 0, 0); //

/*
//
const side              = new Vector(0, 0, 0);
const coord             = ['x', 'y', 'z'];
const INF               = 100000.0;
const eps               = 1e-3;
const _block_vec        = new Vector(0, 0, 0);
const _pos              = new Vector(0, 0, 0);
const vc_trace          = new VectorCollector();
const pos               = new Vector(0, 0, 0);
const pos2              = new Vector(0, 0, 0);

// traceVec3
function traceVec3(p1, p2) {

    pos.copyFrom(p1);
    pos2.copyFrom(p2);

    const pickat_distance   = p1.distance(p2);
    const dir               = p2.sub(p1).normalize();
    const block             = _block_vec.copyFrom(p1);

    vc_trace.clear();

    while (Math.abs(block.x - p1.x) < pickat_distance
        && Math.abs(block.y - p1.y) < pickat_distance
        && Math.abs(block.z - p1.z) < pickat_distance
    ) {
        let tMin = INF;
        for(let d of coord) {
            if(dir[d] > eps && tMin > (block[d]  - pos[d]) / dir[d]) {
                tMin = (block[d] - pos[d]) / dir[d];
                side.zero()[d] = 1;
            }
            if(dir[d] < -eps && tMin > (block[d] - pos[d]) / dir[d]) {
                tMin = (block[d] - pos[d]) / dir[d];
                side.zero()[d] = -1;
            }
        }

        if (tMin >= INF) {
            break;
        }

        pos.x += dir.x * tMin;
        pos.y += dir.y * tMin;
        pos.z += dir.z * tMin;

        for(let x = -1; x <= 1; x++) {
            for(let y = -1; y <= 1; y++) {
                for(let z = -1; z <= 1; z++) {
                    _pos.set(x, y, z).addSelf(pos).flooredSelf();
                    if(_pos.x>=p1.x && _pos.y>=p1.y && _pos.z>=p1.z) {
                        if(_pos.x<=p2.x && _pos.y<=p2.y && _pos.z<=p2.z) {
                            vc_trace.set(_pos, true);
                        }
                    }
                }
            }
        }

        if(pos.equal(p2)) {
            break;
        }

        block.addSelf(side);

    }

    return Array.from(vc_trace.keys());

}
*/

// CaveLine...
class CaveLine {
    [key: string]: any;

    constructor(p_start, p_end, rad, aabb) {
        this.p_start = p_start;
        this.p_end = p_end;
        this.rad = rad;
        this.aabb = aabb;
    }

}

// Cave...
export class Cave {
    [key: string]: any;

    static generateLines(lines, addr, aleaRandom) {

        // Генерируем абсолютную позицию начала пещеры в этом чанке
        let index = Math.trunc(aleaRandom.double() * CHUNK_SIZE * .7);

        // Конвертируем позицию в 3D вектор
        const x = index % CHUNK_SIZE_X;
        const y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
        const z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
        vec_line.set(x, y, z);

        const start_coord = addr.mul(DIVIDER).addSelf(vec_line); //
        let p_start = start_coord.clone();

        // getChunk
        function getChunk(addr) {
            let chunk = lines.get(addr);
            if(!chunk) {
                chunk = {list: []};
                lines.set(addr, chunk);
            }
            return chunk;
        }

        vec_line.x = Infinity;

        let r = aleaRandom.double();
        const length = Math.round(r * MAX_DIR_LENGTH) + 1;
        const vert_coeff = 2;
        let p_end = null;

        let is_treasure = r < .22;

        // Генерация групп(по умолчанию 3 штуки) секций("тела") пещеры
        for(let i = 0; i < GROUP_COUNT; i++) {

            let rad = Math.round(aleaRandom.double() * MAX_RAD) + 1;

            if(vec_line.x == Infinity) {
                // Генерация нового направления группы секций
                if(is_treasure) {
                    rad = TREASURE_ROOM_RAD;
                    vec_line.set(8, 0, 0).flooredSelf();
                } else {
                    vec_line.set(
                        (aleaRandom.double() * 2 - 1) * length,
                        (aleaRandom.double() * 2 - 1) * (length / vert_coeff),
                        (aleaRandom.double() * 2 - 1) * length
                    ).flooredSelf();
                }
                p_end = p_start.add(vec_line);
            } else {
                new_pos.copyFrom(p_end).addSelf(vec_line);
                const max_rad = new_pos.distance(p_end) * .9;
                new_pos.x += (aleaRandom.double() * 2 - 1) * max_rad;
                new_pos.y += (aleaRandom.double() * 2 - 1) * (max_rad / vert_coeff);
                new_pos.z += (aleaRandom.double() * 2 - 1) * max_rad;
                p_end.set(new_pos).flooredSelf();
            }

            //
            const dist_from_start = start_coord.distance(p_end);
            if(dist_from_start > CAVES_MAX_LENGTH) {
                // console.log('break cave', dist, addr.toHash());
                break;
            }

            // Для расчетов максимально разнесенных точек отрезка с учетом радиуса
            _aabb.set(Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity);
            _aabb.addPoint(p_start.x - rad, p_start.y - rad, p_start.z - rad);
            _aabb.addPoint(p_start.x + rad, p_start.y + rad, p_start.z + rad);
            _aabb.addPoint(p_end.x - rad, p_end.y - rad, p_end.z - rad);
            _aabb.addPoint(p_end.x + rad, p_end.y + rad, p_end.z + rad);

            // Вычисляем начальный и конечный чанк для крайних блоков капсули отрезка
            _vec_chunk_start.set(_aabb.x_min, _aabb.y_min, _aabb.z_min).divScalarVec(DIVIDER).flooredSelf();
            _vec_chunk_end.set(_aabb.x_max, _aabb.y_max, _aabb.z_max).divScalarVec(DIVIDER).flooredSelf();

            // Отрезок
            const line = new CaveLine(p_start.clone(), p_end.clone(), rad, _aabb.clone());
            line.is_treasure = is_treasure;
            line.r = aleaRandom.double();
            is_treasure = false;

            // Если отрезок полностью умещается в одном чанке
            if(_vec_chunk_start.equal(_vec_chunk_end)) {
                let chunk = getChunk(_vec_chunk_start);
                chunk.list.push(line);
            } else {
                for(let x = _vec_chunk_start.x; x <= _vec_chunk_end.x; x++) {
                    for(let y = _vec_chunk_start.y; y <= _vec_chunk_end.y; y++) {
                        for(let z = _vec_chunk_start.z; z <= _vec_chunk_end.z; z++) {
                            temp_vec.set(x, y, z);
                            _vec_chunk_coord.set(
                                x * CHUNK_SIZE_X + (CHUNK_SIZE_X / 2),
                                y * CHUNK_SIZE_Y + (CHUNK_SIZE_Y / 2),
                                z * CHUNK_SIZE_Z + (CHUNK_SIZE_Z / 2)
                            );
                            let dist = _vec_chunk_coord.distanceToLine(line.p_start, line.p_end, _intersection);
                            if(dist <= CHUNK_DIAGONAL_LENGTH / 2) {
                                let chunk = getChunk(temp_vec);
                                chunk.list.push(line);
                            }
                        }
                    }
                }
            }

            p_start = p_end.clone();
            // @todo В редких случаях генерируем высокие пещеры

        }

    }

}

// CaveGenerator...
export class CaveGenerator {
    [key: string]: any;

    constructor(seed) {
        this.seed           = typeof seed != 'undefined' ? seed : 'default_seed'; // unique world seed
        this.margin         = CAVES_SERCH_MARGIN;
        this.spiral_moves   = SpiralGenerator.generate3D(new Vector(this.margin, this.margin, this.margin));
        this.lines          = new VectorCollector(); // В ключах адреса чанков, в значениях отрезки, которые затрагивают этот чанк
        this.caves          = new VectorCollector(); // Чтобы не генерировать пещеры в одних и техже чанках много раз подряд
        this._temp_add_vec  = new Vector(0, 0, 0);
        this._neighb        = new Vector(0, 0, 0);
    }

    /**
     * Add cave
     * @param {Vector} chunk_addr 
     * @returns {boolean}
     */
    add(chunk_addr) {

        if(chunk_addr.y < 0 || chunk_addr.y > 2) {
            return false;
        }

        if(!this.caves.has(chunk_addr)) {
            const aleaRandom = new alea(this.seed + chunk_addr.toString());
            if(aleaRandom.double() < .7) {
                this.caves.set(chunk_addr, true);
                return true;
            }
            Cave.generateLines(this.lines, chunk_addr, aleaRandom);
            this.caves.set(chunk_addr, true);
            return true;
        }
        return false;
    }

    /**
     * return neighbour lines
     * @param { Vector } chunk_addr
     * @returns
     */
     getNeighbourLines(chunk_addr) {
        return this.lines.get(chunk_addr);
    }

    /**
     * Инициализация пещер во всех чанках вокруг центрального chunk_addr
     * @param {Vector} chunk_addr 
     */
    addSpiral(chunk_addr) {
        for (let i = 0; i < this.spiral_moves.length; i++) {
            const sm = this.spiral_moves[i];
            this._temp_add_vec.set(chunk_addr.x, chunk_addr.y, chunk_addr.z).addSelf(sm.pos);
            this.add(this._temp_add_vec);
        }
    }

}