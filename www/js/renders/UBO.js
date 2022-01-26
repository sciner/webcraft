export const UNIFORM_TYPE = {
    MAT4: 'mat4',
    MAT3: 'mat3',
    VEC3: 'vec3',
    VEC2: 'vec2',
    VEC3_OBJ: 'vec3_obj',
    VEC4: 'vec4',
    FLOAT: 'float',
    SAMPLER: 'int',
}

const KNOWN_TYPES = Object.fromEntries(
    Object
        .entries(UNIFORM_TYPE)
        .map(([k, v]) => [v, k])
);

export const ARRAY_ALLIGMENT = 4;

export const VALUE_SIZE_TO_TYPE = {
    [1] : UNIFORM_TYPE.FLOAT,
    [2] : UNIFORM_TYPE.VEC2,
    [3] : UNIFORM_TYPE.VEC3,
    [4] : UNIFORM_TYPE.VEC4,
    [9] : UNIFORM_TYPE.MAT3,
    [16] : UNIFORM_TYPE.MAT4,
}

export const TYPE_TO_ALLIGMENT = {
    [UNIFORM_TYPE.MAT4] : 16, // std140
    [UNIFORM_TYPE.MAT3] : 12, // std140
    [UNIFORM_TYPE.VEC2] : 2,  //
    [UNIFORM_TYPE.VEC3] : 4,  // std140
    [UNIFORM_TYPE.VEC3_OBJ] : 4,
    [UNIFORM_TYPE.VEC4] : 4,
    [UNIFORM_TYPE.FLOAT]: 1,
    [UNIFORM_TYPE.SAMPLER]: 1,
}

function validateUniformArray (value) {

    //array of array
    if (!Array.isArray(value)) {
        return false;
    }

    const sub = value[0];

    if (typeof sub !== 'object') {
        return false;
    }

    if (value.length === 0) {
        throw 'Arrayed value should be filled';
    }

    // object
    if ('x' in sub) {
        if (!value.every(e => 'x' in e)) {
            throw 'Arrayed values must be same typed!';
        }
    } else if(Array.isArray(sub) || sub.buffer) {
        const l = sub.length;

        if (!value.every(e => Array.isArray(e) && e.length == l)) {
            throw 'Arrayed values must be same typed and had same lenght!';
        }
    // typed array
    } else {
        const t = typeof sub;

        if (value.every(e => t === e)) {
            throw 'Arrayed values must be same typed!'
        }
    }

    return true;
}

/**
 *
 * @param {Float32Array} view
 * @param {string} type
 * @param {*} value
 * @param {number} offset
 * @returns {number} size of writed to buffer
 */
function mapField(view, type, value, offset) {
    if (type === UNIFORM_TYPE.MAT3) {
        for(let i = 0; i < 3; i ++) {
            view[i * ARRAY_ALLIGMENT + 0 + offset] = value[i * 3 + 0];
            view[i * ARRAY_ALLIGMENT + 1 + offset] = value[i * 3 + 1];
            view[i * ARRAY_ALLIGMENT + 2 + offset] = value[i * 3 + 2];
        }

        return TYPE_TO_ALLIGMENT[type];
    }

    if (typeof value !== 'object') {
        view[0 + offset] = +value;

        return TYPE_TO_ALLIGMENT[type];
    // is object Vector
    } else if ('x' in value) {
        view[0 + offset] = value.x;
        view[1 + offset] = value.y;
        view[2 + offset] = value.z;

        return TYPE_TO_ALLIGMENT[type];
    } else {
        view.set(value, offset);

        return TYPE_TO_ALLIGMENT[type];
    }
}

/**
 * @typedef {Object} UniformModel
 * @property {string} [name]
 * @property {string} [type]
 * @property {*} [value]
 * @property {boolean} [array]
 * @property {number} [offset]
 * @property {number} [size]
 */

export class UniversalUniform {
    static UNIFORM_ID = 0;

    constructor ({
        name,
        type = null,
        value = null,
        array = false, // array of uniforms
        offset = 0,
        autoupdate = true,
    }) {
        if (!name) {
            throw new Error('[UniversalUniform] Unifrom should has name');
        }

        // try eval type
        if (!type && !array && value !== null) {
            if(typeof value !== 'object') {
                type = UNIFORM_TYPE.FLOAT;
                value = +value || 0;
            } else if ('x' in value) {
                type = UNIFORM_TYPE.VEC3_OBJ;
            } else if (value.length) {
                type = VALUE_SIZE_TO_TYPE[value.length];
            }
        }

        if (!type || !(type in KNOWN_TYPES)) {
            throw new Error('[UniversalUniform] Unknow type:' + type + ' for ' + name    );
        }

        this.name = name;
        this.vecObject = false;
        this.arraySize = array ? value.length : 0;

        // internal for UBO
        this.size = array
            ? this.arraySize * Math.max(ARRAY_ALLIGMENT, TYPE_TO_ALLIGMENT[type]) // array always aligned to 4 WEBGL
            : TYPE_TO_ALLIGMENT[type];

        this._dirty = true;

        this._mapId = -2;

        this._updateId = -1;

        this._value = value;

        // internal for UBO
        // std140
        this.offset = offset;

        this.type = type;

        this.id = UniversalUniform.UNIFORM_ID ++;

        /**
         * View for UBO array, attached by UBO
         * @type {Float32Array}
         */
        this.view = null;

        this.locateToView = this._value == null
            && type !== UNIFORM_TYPE.MAT3
            // we can direcly locate value to view when possible and not require remap
            && (!array || array && TYPE_TO_ALLIGMENT[type] % 4 === 0);

        /**
         * Lazy maping a setter onto view in update call
         */
        this.lazyMap = false;

        this.autoupdate = autoupdate || this.locateToView;
    }

    /**
     * fire invalidation
     */
    needUpdate() {
        this._dirty = true;
        this._mapId ++;

        if (!this.lazyMap) {
            this._mapValue();
        }
    }

    get value() {
        return this.locateToView
            ? this.view
            : this._value;
    }

    // check
    set value(v) {

        this._value = v;

        this.needUpdate();
    }

    /**
     * Map value onto view and back
     */
    _mapValue() {
        if (this._mapId === this._updateId && !this.autoupdate) {
            return;
        }

        if (this.locateToView) {
            this._mapId = this._updateId;
            return;
        }

        const {
            type, view, arraySize, _value
        } = this;

        // not array, map maybe fast
        if (arraySize === 0) {
            // more universal way
            mapField(view, type, _value, 0);

            this._mapId = this._updateId;
            return;
        }

        // array map case
        // offset is alligned of 4,
        // [1, 2, 3] will be => [1, -, -, -, 2, -, -, -, 3, -, -, -]
        let offset = 0;

        for(let i = 0; i < arraySize; i ++) {
            const wrote = mapField(view, type, _value[i], offset);

            offset += Math.min(wrote, 4);
        }

        this._mapId = this._updateId;
    }

    /**
     *
     * @returns {boolean} true when something changed
     */
    upload() {
        const dirty = this._dirty || this.autoupdate;

        // map value if changed
        if (dirty) {
            this._mapValue();
        }

        this._dirty = false;
        this._updateId ++;
        this._mapId = this._updateId;

        return dirty;
    }
}

export class BaseUBO {
    /**
     *
     * @param {{[key: string]: UniformModel}} uboModel
     */
    constructor (uboModel) {
        /**
         * @type {Float32Array}
         */
        this.data = null;

        /**
         * @type {{[key: string]: UniversalUniform}}
         */
        this.fields = Object.create({});

        this.init(uboModel);

        this.updateId = -1;
    }

    get size() {
        return this.data.length;
    }

    /**
     *
     * @param {{[key: string]: UniformModel}} dataModel
     */
    init(dataModel) {
        //parse and apply

        const fields = [];

        let pos = 0;

        let isOffseted = false;

        for(let key in dataModel) {
            const u = dataModel[key];

            if (!u.name) {
                u.name = key;
            }

            const filed = new UniversalUniform(u);

            fields.push(filed);

            this.fields[filed.name] = filed;

            if (filed.offset > 0) {
                pos = Math.max(size, filed.size + filed.offset);
                isOffseted = true;

                continue;
            }

            if (isOffseted) {
                throw 'All uniforms shoul have their offset and size when present or not any';
            }

            let alligment = TYPE_TO_ALLIGMENT[filed.type];

            if (filed.arraySize > 0) {
                alligment = filed.arraySize * ARRAY_ALLIGMENT; // array has aligment of 4;
            }

            const offset = Math.ceil(pos / alligment) * alligment;

            // compute offset
            filed.offset = offset;

            pos = offset + filed.size;
        }

        // align up to 4
        pos = Math.ceil(pos / 4) * 4;

        // buffer size
        this.data = new Float32Array(pos);

        // create view
        for(let field of fields) {
            field.view = this.data.subarray(field.offset, (field.offset + field.size));
        }
    }

    /**
     * Update UBO and calculate diff of changed values
     * UpdateID is current update index, you can use bufferSubData when delta is 1 (1 update between uploads)
     * @returns {{start: number, end: number, changed: boolean, updateId: number}}
     */
    update() {
        let start = Infinity;
        let end = 0;
        let changed = false;

        for(const key in this.fields) {

            const f = this.fields[key];

            if(f.upload()) {
                start = Math.min(start, f.offset);
                end = Math.max(end, f.offset + f.size);
                changed = true;
            }
        }

        if (start > end) {
            start = 0;
        }

        if (end === 0) {
            end = this.size;
        }

        /*if (changed) {
            
        }*/
        this.updateId ++;

        return {
            start, end, changed, updateId : this.updateId
        }
    }
}