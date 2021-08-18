import {impl as alea} from '../../vendors/alea.js';
import {Vector, SpiralGenerator} from "./helpers.js";

// Cave...
export class Cave {

    // Constructor
    constructor(seed, addr) {
        let csy             = CHUNK_SIZE_Y_MAX; // CHUNK_SIZE_Y
        this.alea           = new alea(seed + addr.toString());
        this.head_pos       = null;
        this.coord          = addr.mul(new Vector(CHUNK_SIZE_X, csy, CHUNK_SIZE_Z));
        this.points         = [];
        this.chunks         = {};
        //
        let r               = this.alea.double();
        let index           = r;
        // проверяем нужно или нет начало пещеры в этом чанке
        if(index < .99) {
            let addPoint = (point) => {
                point.pos = point.pos.toInt();
                let chunk_addr = point.pos.div(new Vector(CHUNK_SIZE_X, csy, CHUNK_SIZE_Z)).toInt();
                if(!(chunk_addr in this.chunks)) {
                    this.chunks[chunk_addr] = {points: []};
                }
                this.chunks[chunk_addr].points.push(point);
            };
            // Общее количество блоков в чанке
            let block_count = CHUNK_SIZE_X * csy * CHUNK_SIZE_Z;
            // Генерируем абсолютную позицию начала пещеры в этом чанке
            index = parseInt(block_count * .05 + this.alea.double() * block_count * .5);
            // Конвертируем позицию в 3D вектор
            this.head_pos = addr.mul(new Vector(CHUNK_SIZE_X, csy, CHUNK_SIZE_Z)).add(new Vector(
                index % CHUNK_SIZE_X,
                parseInt(index / (CHUNK_SIZE_X * CHUNK_SIZE_Z)),
                parseInt((index % (CHUNK_SIZE_X + CHUNK_SIZE_Z)) / CHUNK_SIZE_X)
            ));
            const DEF_RAD   = 5;
            const MIN_RAD   = 2; // минимальный радиус секции
            const MAX_RAD   = 10; // максимальный радиус секции
            let rad         = DEF_RAD;
            // Добавляем "голову" пещеры
            addPoint({rad: rad, pos: this.head_pos});
            let point_pos = this.head_pos;
            // Генерация групп(по умолчанию 3 штуки) секций("тела") пещеры
            for(let _ of [1, 2, 3]) {
                let pts_count = parseInt(this.alea.double() * MAX_RAD) + 1;
                // Генерация нового направления группы секций
                let direction = new Vector(
                    (this.alea.double() * 2 - 1) * 4,
                    (this.alea.double() * 2 - 1) * 1.25,
                    (this.alea.double() * 2 - 1) * 4,
                );
                for(let i = 0; i < pts_count; i++) {
                    point_pos = point_pos.add(direction);
                    rad = parseInt((rad + this.alea.double() * DEF_RAD + MIN_RAD) / 2);
                    let point = {
                        rad: rad,
                        pos: point_pos
                    };
                    addPoint(point);
                    // В редких случаях генерируем высокие пещеры
                    if(r < .1) {
                        addPoint({rad: point.rad, pos: point.pos.add(new Vector(0, -DEF_RAD * .9, 0))});
                        if(r < .065) {
                            addPoint({rad: point.rad, pos: point.pos.add(new Vector(0, -DEF_RAD * 2 * .9, 0))});
                        }
                    }
                }
            }
        }
    }

}

// CaveGenerator...
export class CaveGenerator {

    constructor(seed) {
        this.seed           = typeof seed != 'undefined' ? seed : 'default_seed'; // unique world seed
        this.caves          = {};
        this.margin         = 8;
        this.spiral_moves   = SpiralGenerator.generate(this.margin);
    }

    // add
    add(chunk_addr) {
        chunk_addr = new Vector(chunk_addr.x, 0, chunk_addr.z);
        let key = chunk_addr.toString();
        if(typeof this.caves[key] == 'undefined') {
            this.caves[key] = new Cave(this.seed, chunk_addr);
        }
        return this.caves[key];
    }

    // get
    get(chunk_addr) {
        chunk_addr = new Vector(chunk_addr.x, 0, chunk_addr.z);
        let key = chunk_addr.toString();
        return this.caves[key];
    }

    /**
     * getNeighboors
     * @param { Vector } chunk_addr 
     * @returns 
     */
    getNeighboors(chunk_addr) {
        chunk_addr = new Vector(chunk_addr.x, 0, chunk_addr.z);
        let NEIGHBOORS_CAVES_RADIUS = 5;
        let neighboors_caves        = [];
        for(let cx = -NEIGHBOORS_CAVES_RADIUS; cx < NEIGHBOORS_CAVES_RADIUS; cx++) {
            for(let cz = -NEIGHBOORS_CAVES_RADIUS; cz < NEIGHBOORS_CAVES_RADIUS; cz++) {
                let map_cave = this.get(chunk_addr.add(new Vector(cx, 0, cz)));
                if(map_cave && map_cave.head_pos) {
                    if(map_cave.chunks.hasOwnProperty(chunk_addr)) {
                        neighboors_caves.push(map_cave.chunks[chunk_addr]);
                    }
                }
            }
        }
        return neighboors_caves;
    }

    // addSpiral
    addSpiral(chunk_addr) {
        chunk_addr = new Vector(chunk_addr.x, 0, chunk_addr.z);
        this.add(chunk_addr.add(new Vector(0, 0, 0)));
        for(let sm of this.spiral_moves) {
            this.add(chunk_addr.add(sm));
        }
    }

}