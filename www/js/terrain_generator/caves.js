import {impl as alea} from '../../vendors/alea.js';
import {Vector, SpiralGenerator, VectorCollector} from "../helpers.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_BLOCKS} from "../chunk.js";
import {AABB} from '../core/AABB.js';

// Общее количество блоков в чанке
const DIVIDER                   = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
const MAX_RAD                   = 3; // максимальный радиус секции
const MAX_DIR_LENGTH            = 40;
const MAX_DIR_HEIGHT            = 10;
const _aabb                     = new AABB();
const temp_vec                  = new Vector(0, 0, 0);
const _vec_chunk_start          = new Vector(0, 0, 0); // Адрес чанка, где начинается отрезок
const _vec_chunk_end            = new Vector(0, 0, 0); // Адрес чанка, где заканчивается отрезок

// CaveLine...
class CaveLine {

    constructor(p_start, p_end, rad) {
        this.p_start = p_start;
        this.p_end = p_end;
        this.rad = rad;
    }

}

// Cave...
export class Cave {

    // Constructor
    constructor(lines, seed, addr) {

        const aleaRandom = new alea(seed + addr.toString());

        if(aleaRandom.double() < .5) {
            return;
        }

        // Генерируем абсолютную позицию начала пещеры в этом чанке
        let index = parseInt(aleaRandom.double() * CHUNK_BLOCKS);

        // Конвертируем позицию в 3D вектор
        const x = index % CHUNK_SIZE_X;
        const y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
        const z = ((index) % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - x) / CHUNK_SIZE_X;
        temp_vec.set(x, y, z);

        let p_start = addr.mul(DIVIDER).addSelf(temp_vec);

        // getChunk
        function getChunk(addr) {
            let chunk = lines.get(addr);
            if(!chunk) {
                chunk = {list: []};
                lines.set(addr, chunk);
            }
            return chunk;
        }

        // Генерация групп(по умолчанию 3 штуки) секций("тела") пещеры
        for(let i = 0; i < 5; i++) {

            let r = aleaRandom.double();
            const length = Math.round(r * MAX_DIR_LENGTH) + 1;
            const height = Math.round(r * MAX_DIR_HEIGHT);
            const rad = Math.round(aleaRandom.double() * MAX_RAD) + 1;

            // Генерация нового направления группы секций
            temp_vec.set(
                (aleaRandom.double() * 2 - 1) * length,
                (aleaRandom.double() * 2 - 1) * height,
                (aleaRandom.double() * 2 - 1) * length,
            ).flooredSelf();
            let p_end = p_start.add(temp_vec);

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
            const line = new CaveLine(p_start.clone(), p_end.clone(), rad);

            // Если отрезок полностью умещается в одном чанке
            if(_vec_chunk_start.equal(_vec_chunk_end)) {
                let chunk = getChunk(_vec_chunk_start);
                chunk.list.push(line);
            } else {
                for(let x = _vec_chunk_start.x; x <= _vec_chunk_end.x; x++) {
                    for(let y = _vec_chunk_start.y; y <= _vec_chunk_end.y; y++) {
                        for(let z = _vec_chunk_start.z; z <= _vec_chunk_end.z; z++) {
                            let chunk = getChunk(temp_vec.set(x, y, z));
                            chunk.list.push(line);
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

    constructor(seed) {
        this.seed           = typeof seed != 'undefined' ? seed : 'default_seed'; // unique world seed
        this.margin         = 4;
        this.spiral_moves   = SpiralGenerator.generate3D(new Vector(this.margin, this.margin, this.margin));
        this.lines          = new VectorCollector(); // В ключах адреса чанков, в значениях отрезки, которые затрагивают этот чанк
        this.caves          = new VectorCollector(); // Чтобы не генерировать пещеры в одних и техже чанках много раз подряд
        this._temp_add_vec  = new Vector(0, 0, 0);
        this._neighb        = new Vector(0, 0, 0);
    }

    // add
    add(chunk_addr) {
        if(!this.caves.has(chunk_addr)) {
            new Cave(this.lines, this.seed, chunk_addr);
            this.caves.set(chunk_addr, true);
            return true;
        }
        return false;
    }

    /**
     * getNeighbourLines
     * @param { Vector } chunk_addr 
     * @returns 
     */
     getNeighbourLines(chunk_addr) {
        this._neighb.set(chunk_addr.x, 0, chunk_addr.z);
        return this.lines.get(this._neighb);
    }

    // Инициализация пещер во всех чанках вокруг центрального chunk_addr
    addSpiral(chunk_addr) {
        for(let sm of this.spiral_moves) {
            this._temp_add_vec.set(chunk_addr.x, chunk_addr.y, chunk_addr.z).addSelf(sm.pos);
            this.add(this._temp_add_vec);
        }
    }

}