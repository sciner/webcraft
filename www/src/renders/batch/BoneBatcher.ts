import {Buffer} from 'vauxcel';
import type {Vector} from "../../helpers/vector.js";
import type {Color} from "../../helpers/color.js";
import {IvanArray} from "../../helpers.js";

export interface IBoneBatcherSettings {
    bone_count: number; // up to 1023
    pos_count: number; // up to 1023
    tint_count: number; // up to 1023
    multiplier: number;
}

export interface IBoneBatcherElement {
    batch: BoneBatch;
    pos: Vector;
    matrix: imat4;
    tint_color: Color;
    uniforms_id: int;
    batch_id: int;
}

export class BoneBatch {
    bone_shift: number;
    pos_shift: number;
    tint_shift: number;

    bone_count: number;
    pos_count: number;
    tint_count: number;

    buffers: BoneBufferSet;
    constructor() {
    }

    reset() {
        this.bone_shift = 0;
        this.bone_count = 0;

        this.pos_shift = 0;
        this.pos_count = 0;

        this.tint_shift = 0;
        this.tint_count = 0;
    }
}

const EPS = 0.001;
const BONE_FLOATS = 12;
const POS_FLOATS = 4;
const TINT_FLOATS = 4;

export let GLOBAL_BONE_BUFFER_BATCH_ID = 0;

export class BoneBufferSet {
    bone_data: Float32Array;
    pos_data: Float32Array;
    tint_data: Float32Array;
    bone_buffer: Buffer;
    pos_buffer: Buffer;
    tint_buffer: Buffer;
    settings: IBoneBatcherSettings;
    batch_id: number;
    constructor(settings: IBoneBatcherSettings) {
        this.settings = settings;

        const { multiplier } = settings;

        this.bone_data = new Float32Array(settings.bone_count * multiplier * BONE_FLOATS);
        this.pos_data = new Float32Array(settings.pos_count * multiplier * POS_FLOATS);
        this.tint_data = new Float32Array(settings.tint_count * multiplier * TINT_FLOATS);

        this.bone_buffer = new Buffer(this.bone_data, false, false);
        this.pos_buffer = new Buffer(this.pos_data, false, false);
        this.tint_buffer = new Buffer(this.tint_data, false, false);

        this.reset();
    }

    reset() {
        this.bone_count = 0;
        this.pos_count = 0;
        this.tint_count = 0;
        this.batch_id = ++GLOBAL_BONE_BUFFER_BATCH_ID;
    }

    bone_count: number;
    pos_count: number;
    tint_count: number;
    batch: BoneBatch = null;
    entries = new IvanArray<IBoneBatcherElement>();

    addElementOrFail(elem: IBoneBatcherElement): boolean {
        const mat = elem.matrix;
        const pos = elem.pos;
        const tint = elem.tint_color;
        const { bone_data, pos_data, tint_data, batch } = this;

        let pos_id;
        if (!pos || Math.abs(pos.x) + Math.abs(pos.y) + Math.abs(pos.z) < EPS) {
            pos_id = 0;
        } else {
            let ind = this.pos_count * POS_FLOATS;
            let check = batch.pos_count > 0;
            check = check && Math.abs(pos.x - pos_data[ind]) < EPS
                && Math.abs(pos.y - pos_data[ind + 1]) < EPS
                && Math.abs(pos.z - pos_data[ind + 2]) < EPS;
            if (check) {
                pos_id = this.pos_count;
            } else {
                if (ind >= pos_data.length) {
                    return false;
                }
                pos_id = ++this.pos_count;
                ind = this.pos_count * BONE_FLOATS;
                pos_data[ind] = pos.x;
                pos_data[ind + 1] = pos.y;
                pos_data[ind + 2] = pos.z;
            }
        }

        let bone_id;
        if (!mat || Math.abs(mat[0] - 1) < EPS && Math.abs(mat[5] - 1) < EPS && Math.abs(mat[10] - 1) < EPS
            && Math.abs(mat[1]) + Math.abs(mat[2]) + Math.abs(mat[4])
            + Math.abs(mat[6]) + Math.abs(mat[8]) + Math.abs(mat[9]) < EPS) {
            bone_id = 0;
        } else {
            let ind = this.bone_count * BONE_FLOATS;
            let check = batch.bone_count > 0;
            check = check &&
                Math.abs(mat[0] - bone_data[ind])
                + Math.abs(mat[4] - bone_data[ind + 1])
                + Math.abs(mat[8] - bone_data[ind + 2])
                + Math.abs(mat[12] - bone_data[ind + 3]) < EPS;
            check = check &&
                Math.abs(mat[1] - bone_data[ind + 4])
                + Math.abs(mat[5] - bone_data[ind + 5])
                + Math.abs(mat[9] - bone_data[ind + 6])
                + Math.abs(mat[13] - bone_data[ind + 7]) < EPS;
            check = check &&
                Math.abs(mat[2] - bone_data[ind + 8])
                + Math.abs(mat[6] - bone_data[ind + 9])
                + Math.abs(mat[10] - bone_data[ind + 10])
                + Math.abs(mat[14] - bone_data[ind + 11]) < EPS;
            if (check) {
                bone_id = this.bone_count;
            } else {
                if (ind >= bone_data.length) {
                    return false;
                }
                bone_id = ++this.bone_count;
                ind = this.bone_count * BONE_FLOATS;

                bone_data[ind] = mat[0];
                bone_data[ind + 1] = mat[4];
                bone_data[ind + 2] = mat[8];
                bone_data[ind + 3] = mat[12];
                bone_data[ind + 4] = mat[1];
                bone_data[ind + 5] = mat[5];
                bone_data[ind + 6] = mat[9];
                bone_data[ind + 7] = mat[13];
                bone_data[ind + 8] = mat[2];
                bone_data[ind + 9] = mat[6];
                bone_data[ind + 10] = mat[10];
                bone_data[ind + 11] = mat[14];
            }
        }

        let tint_id;
        if (!tint || Math.abs(tint.r) + Math.abs(tint.g) + Math.abs(tint.b) + Math.abs(tint.a) < EPS) {
            tint_id = 0;
        } else {
            let ind = this.tint_count * POS_FLOATS;
            let check = batch.tint_count > 0 && ind < tint_data.length;
            check = check && Math.abs(tint.r - tint_data[ind]) < EPS
                && Math.abs(tint.g - tint_data[ind + 1]) < EPS
                && Math.abs(tint.b - tint_data[ind + 2]) < EPS
                && Math.abs(tint.a - tint_data[ind + 3]) < EPS;
            if (check) {
                tint_id = this.tint_count;
            } else {
                if (ind >= tint_data.length) {
                    return false;
                }
                tint_id = ++this.tint_count;
                ind = this.pos_count * BONE_FLOATS;
                tint_data[ind] = tint.r;
                tint_data[ind + 1] = tint.g;
                tint_data[ind + 2] = tint.b;
                tint_data[ind + 3] = tint.a;
            }
        }

        elem.uniforms_id = (tint_id << 20) | (bone_id << 10) | pos_id;
        elem.batch_id = this.batch_id;

        return true;
    }
}

export class BoneBatcher {
    settings: IBoneBatcherSettings;
    buffer_sets: BoneBufferSet[];
    buffer_ind: number;
    constructor() {
        this.settings = {
            // 12 floats
            bone_count: 128,
            // 3 floats
            pos_count: 512,
            // 4 floats
            tint_count: 128,
            multiplier: 10,
        }

        this.buffer_sets = [new BoneBufferSet(this.settings)];
    }

    reset() {
        for (let i = 0; i <= this.buffer_ind; i++) {
            this.buffer_sets[i].reset();
        }
        this.buffer_ind = 0;
    }

    addElement(elem: IBoneBatcherElement) {
        while (this.buffer_ind < this.buffer_sets.length) {
            if (this.buffer_sets[this.buffer_ind].addElementOrFail(elem)) {
                return;
            }
            this.buffer_ind++;
        }
        this.buffer_sets.push(new BoneBufferSet(this.settings));
        this.buffer_sets[this.buffer_ind].addElementOrFail(elem);
    }
}
