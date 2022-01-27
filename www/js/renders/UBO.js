import { BaseDataModel } from "./BaseDataModel.js";

export const UNIFORM_TYPE = {
    STRUCT   :'struct',
    MAT4     : 'mat4',
    MAT3     : 'mat3',
    VEC3     : 'vec3',
    VEC2     : 'vec2',
    VEC3_OBJ : 'vec3_obj', // same as vec3, but mark that value is  {x, y, z}
    VEC4     : 'vec4',
    FLOAT    : 'float',
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
    [UNIFORM_TYPE.STRUCT]   : 16, // std140
    [UNIFORM_TYPE.MAT4]     : 16, // std140
    [UNIFORM_TYPE.MAT3]     : 12, // std140
    [UNIFORM_TYPE.VEC2]     : 2,  //
    [UNIFORM_TYPE.VEC3]     : 4,  // std140
    [UNIFORM_TYPE.VEC3_OBJ] : 4,
    [UNIFORM_TYPE.VEC4]     : 4,
    [UNIFORM_TYPE.FLOAT]    : 1,
}

const MAP_MAT3 = (buffer, offset, value) => {
    for(let i = 0; i < 3; i ++) {
        buffer[i * 4 + 0 + offset] = value[i * 3 + 0];
        buffer[i * 4 + 1 + offset] = value[i * 3 + 1];
        buffer[i * 4 + 2 + offset] = value[i * 3 + 2];
    }

    return TYPE_TO_ALLIGMENT[UNIFORM_TYPE.MAT3];
};

// map value and return alligned size
const MAP_VEC3_OBJ = (buffer, offset, value) => {
    buffer[offset + 0] = +value.x || 0;
    buffer[offset + 1] = +value.y || 0;
    buffer[offset + 2] = +value.z || 0;

    return TYPE_TO_ALLIGMENT[UNIFORM_TYPE.VEC3];
};

// map value and return alligned size
const MAP_VEC3 = (buffer, offset, value) => {
    buffer[offset + 0] = +value[0] || 0;
    buffer[offset + 1] = +value[1] || 0;
    buffer[offset + 2] = +value[2] || 0;

    return TYPE_TO_ALLIGMENT[UNIFORM_TYPE.VEC3];
};

const MAP_FLOAT = (buffer, offset, value) => {
    buffer[offset + 0] = +value || 0;

    return TYPE_TO_ALLIGMENT[UNIFORM_TYPE.FLOAT];
};

const MAP_ALLIGNED = (buffer, offset, value) => {
    buffer.set(value, offset);
    
    return value.length;
};

export const FIELD_MAPPERS = {
    [UNIFORM_TYPE.STRUCT]   : MAP_ALLIGNED,
    [UNIFORM_TYPE.MAT4]     : MAP_ALLIGNED,
    [UNIFORM_TYPE.VEC4]     : MAP_ALLIGNED,
    [UNIFORM_TYPE.VEC2]     : MAP_ALLIGNED,
   
    [UNIFORM_TYPE.MAT3]     : MAP_MAT3,
    [UNIFORM_TYPE.VEC3_OBJ] : MAP_VEC3_OBJ,
    [UNIFORM_TYPE.VEC3]     : MAP_VEC3,

    [UNIFORM_TYPE.FLOAT]    : MAP_FLOAT

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
    if (!(type in FIELD_MAPPERS)) {
        throw new Error('Unknown mapper for ' + type);
    }

    return FIELD_MAPPERS[type](view, offset, value);
}

/**
 * @typedef {Object} StrictFieldModel
 * @property {string} [name]
 * @property {string} [type]
 * @property {*} [value]
 * @property {number} [arraySize]
 * @property {number} [offset]
 * @property {number} [size]
 * @property {boolean} [mapToView]
 */

/**
 * 
 * @param {StrictFieldModel} model 
 */
const reconstructTypeSize = (model) => {
    if (model.type in KNOWN_TYPES && model.type !== UNIFORM_TYPE.STRUCT) {
        return {
            type: model.type,
            size: TYPE_TO_ALLIGMENT[model.type]
        };
    }

    if (model.type === UNIFORM_TYPE.STRUCT) {
        if (!model.value) {
            throw new Error('Structed subfield should have value layout');
        }

        if (model.value instanceof StructField) {
            return model.value;
        }

        return {
            type: UNIFORM_TYPE.STRUCT,
            size: -1, // pass for evaluate after
        }
    }

    if (model.value !== null) {

        const val = model.array ? model.value[0] : model.value;

        if (typeof val !== 'object') {
            return {
                type: UNIFORM_TYPE.FLOAT,
                size: TYPE_TO_ALLIGMENT[UNIFORM_TYPE.FLOAT]
            };
        }

        if ('x' in val) {
            return {
                type: UNIFORM_TYPE.VEC3_OBJ,
                size: TYPE_TO_ALLIGMENT[UNIFORM_TYPE.VEC3_OBJ]
            };
        }

        if (val.length) {
            const type = VALUE_SIZE_TO_TYPE[val.length];
            
            if (type) {
                return {
                    type: type,
                    size: TYPE_TO_ALLIGMENT[type]
                };
            }
        }

        throw new Error('Unknown size or type for ', model.name, model.type);
    }
}

export class StructField extends BaseDataModel {
    /**
     * @type {typeof Struct}
     */
    static STRUCT_CTOR = null;// Struct;
    /**
     * 
     * @param {StrictFieldModel} model 
     */
    constructor (model) {
        super();
        this.model = model;

        let value = model.value;
        let {
            type, size
        } = reconstructTypeSize(model);

        this.type = type;

        this.name = model.name;

        /**
         * View to typed array struct
         * @type {Float32Array}
         */
        this.view = null;

        this.arraySize = model.arraySize || 0; // to simple use

        this.offset = model.offset || 0;

        // nested struct 
        if (this.type === UNIFORM_TYPE.STRUCT) {
            value = new this.constructor.STRUCT_CTOR(model.value, {name: this.name, inferProps: true});
            size = Math.ceil(this._value.fullSize / 4) * 4; // aligned to 16 bytes, we use size of floart
        } else {
            value = model.value || null;
        }

        /**
         * SIZE of TYPE (with aligments)
         * For arrayed or full structed size read fullSize
         */
        this.size = size;
        this._value = value;

        // map to view allowed only for 4 paded structures
        this._mapToView = (model.mapToView || model.value == null) 
            && TYPE_TO_ALLIGMENT[this.type] % 4 == 0 
            && this.arraySize === 0;
    }

    /**
     * Attach or reactach view 
     * @param {Float32Array} view
     * @param {boolean} clone
     */
    attach(view, clone = true) {
        if (view.length !== this.fullSize) {
            throw new Error(`[Field ${this.name}] Attached view should be same size as struct field `)
        }

        const oldView = this.view;

        this.view = view;

        if (this.type === UNIFORM_TYPE.STRUCT) {
            // clone subStruct when a view was detached 
            this._value.attach(view, clone || this._value.view.buffer !== oldView.buffer);
        } else if(clone && oldView) {
            view.set(oldView);
        } else if (!oldView && this._value != null) {
            this._map(this._value);
        } 

    }

    get fullSize() {
        if (this.arraySize > 0) {
            return Math.ceil(this.arraySize * this.size / 4) * 4; // allign to 4
        }

        return this.size;
    }

    get mapToView() {
        return this._mapToView;
    }

    // alliased to get
    get value() {
        return this.get();
    }

    // alliased to get
    set value(v) {
        this.set(v);
    }

    set (value) {
        if (this.type === UNIFORM_TYPE.STRUCT) {
            throw new Error(`[Field ${this.name}] Can't load value directly to structs field `)
            return false;
        }

        this._map(value);
        return true;
    }

    get () {
        return this._mapToView ? this.view : this._value;
    }

    /**
     * Map value to buffer
     * @param {*} value 
     */
    _map(value) {
        this._value = value;

        if (this.arraySize === 0) {
            return FIELD_MAPPERS[this.type](this.view, 0, value);
        }

        let offset = 0;

        for(let i = 0; i < Math.min(this._value.length, this.arraySize); i ++) {
            const wrote = FIELD_MAPPERS[this.type](view, offset, value[i]);

            offset += Math.ceil(wrote / 4) * 4;
        }

        // emit event
        this.invalidate();
    }

    // nothing
    update() {

    }
}

export class UniversalUniform extends StructField {

    /**
     * @type {typeof Struct}
     */
    static STRUCT_CTOR = null;// Struct;

    /**
     * 
     * @param {StrictFieldModel} model 
     */
    constructor (model) {
        super(model);

        if (!this.name) {
            throw new Error('[UniversalUniform] Unifrom should has name');
        }

        this._dirty = true;
    }

    set(v) {
        super.set(v);
        this.needUpdate();
    }

    /**
     * fire invalidation
     */
    needUpdate() {
        this._dirty = true;
    }

    /**
     *
     * @returns {boolean} true when something changed
     */
    update() {
        const dirty = this._dirty;

        this._dirty = false;

        return dirty;
    }
}

export class Struct extends BaseDataModel {
    /**
     * @type {typeof StructField}
     */
    static FIELD_CTOR = null;// StructField;

    /**
     *
     * @param {{[key: string]: StrictFieldModel}} model
     * @param {{name: string, inferProps: boolean}} opts - name of struct, inferProps - struct can define get/set for props in body to easy lookup
     */
    constructor (model, opts = {name: '', inferProps: true}) {
        super();
        this.model = model;
        this.options = opts || {};

        this.name = model.name || '';

        /**
         * @type {Float32Array}
         */
        this.view = null;

        /**
         * @type {{[key: string]: StructField}}
         */
        this.fields = Object.create({});

        this.updateId = -1;

        this.size = 0;

        this.lastDiff = {start: 0, end: 0, updateId: -1, changed: false};

        this.init(model);
    }
    /**
     * Set value to Struct field, return true is all ok
     * @param {string} fieldName 
     * @param {*} value 
     * @returns {boolean}
     */
    set (fieldName, value) {
        if (!(fieldName in this.fields)) {
            return false;
        }

        return this.fields[fieldName].set(value);
    }

    /**
     * Get field name, if field not preset will be null
     * @param {string} filedName 
     * @returns 
     */
    get (filedName) {
        const f = this.fields[filedName];

        return f ? f.get() : null;
    }

    // for struct is same
    get fullSize() {
        return this.size;
    }

    /**
     * Attach struct to data buffer
     * NOTE - data can be loosed
     * @param {Float32Array} view
     * @param {boolean} clone - try to clone older value to new
     */
    attach(view, clone) {
        if (this.fullSize !== view.length) {
            throw new Error(`[Struct ${this.name}] Struct size should mach to view size and must be:` + this.fullSize);
        }

        this.view = view;

        const oldView = this.view;

        if (clone && oldView) {
            oldView.set(oldView);

            // we clone buffer for views at once of all
            clone = false;
        }

        for(let key in this.fields) {
            const field = this.fields[key];
            const sub = view.subarray(field.offset, (field.offset + field.size));

            field.attach(sub, clone);
        }
    }

    _infer (key) {
        // 
        if (this[key] != null) {
            console.warn(`[Struct ${this.name}] Field cant be infered because collided with already existed`, key, this[key]);
            return;
        }

        const that = this;
        const fields = this.fields;

        // infer 
        Object.defineProperty(this, key, {
            get() {
                return fields[key].get();
            },
            set(v) {
                return fields[key].set(v);
            }
        });
    }

    /**
     *
     * @param {{[key: string]: StrictFieldModel}} dataModel
     */
    init(dataModel) {
        //parse and apply

        const fields = [];
        const FieldCtor = this.constructor.FIELD_CTOR;

        let pos = 0;

        let isOffseted = false;

        for(let key in dataModel) {
            const u = dataModel[key];

            if (!u.name) {
                u.name = key;
            }

            /**
             * @type {StructField}
             */
            const filed = new FieldCtor(u);

            fields.push(filed);

            this.fields[filed.name] = filed;

            if (this.options.inferProps) {
                this._infer(filed.name);
            }

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

        this.size = pos;

        // attach buffer
        this.attach(new Float32Array(this.fullSize))
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

            if(f.update()) {
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

        this.lastDiff = {
            start, end, changed, updateId : this.updateId
        };

        this.invalidate();

        return this.lastDiff;
    }
}

export class BaseUBO extends Struct {
    static FIELD_CTOR = UniversalUniform;
};

StructField.STRUCT_CTOR = Struct;
UniversalUniform.STRUCT_CTOR = Struct;

Struct.FIELD_CTOR = StructField;
BaseUBO.FIELD_CTOR = UniversalUniform;

