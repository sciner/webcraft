import WebGLRenderer from "./index.js";
import { BaseUBO } from "../UBO.js";
import { WebGLBuffer } from "./WebGLBuffer.js";
import { BaseDataModelHandler } from "../BaseDataModel.js";

/**
 * WebGL UBO implementation
 */
export class WebGLUBO extends BaseDataModelHandler {
    /**
     * 
     * @param {WebGLRenderer} context 
     */
    constructor (context, {bindingIndex = 0} = {}) {
        super();

        this.context = context;

        /**
         * @type {BaseUBO}
         */
        this._model = null;
        this._valid = false;

        /**
         * @type {WebGLBuffer}
         */
        this._buffer = null;

        this.updateId = -1;

        this.bindingIndex = bindingIndex;

        this.onInvalidate = this.onInvalidate.bind(this);
    }

    get nativeBuffer() {
        return this._buffer.buffer;
    }

    /**
     * 
     * @param {BaseUBO} model 
     */
    init(model) {
        if (model == this._model) {
            return;
        }

        if (model === null) {
            this.dispose();
            return;
        }

        this._size = model.size;

        this.alligment = this.context.gl.getParameter(this.context.gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT);

        console.log('Ubo buffer aligment', this.alligment);

        if (!this._buffer) {
            this._buffer = this.context.createBuffer({
                type: 'uniform',
                usage: 'dynamic',
                size: Math.ceil(4 * model.fullSize / this.alligment) * this.alligment
            });
        }

        this._valid = true;

        this.attach(model);
        this.update();

        const gl = this.context.gl;

        // bind UBO
        gl.bindBufferBase(gl.UNIFORM_BUFFER, this.bindingIndex, this._buffer.buffer);
    }

    update() {
        if (!this._valid) {
            return;
        }

        this._updateInternal(this._model.update());
    }

    _updateInternal(state) {
        if(!this._valid) {
            return;
        }

        if (state.updateId === this.updateId) {
            return;
        }

        const partial = (this.updateId + 1) === state.updateId;

        // we can partial update UBO buffer
        // because minor diff 
        // not workin yet for any cases
        // 
        if (partial && false) {
            this._buffer.update(
                this._model.view,
                state.start,
                state.end
            )
        } else {
            this._buffer.update(
                this._model.view,
                0,
                0
            )
        }

        this.updateId = state.updateId;

        super.update();
    }

    onInvalidate () {
        super.onInvalidate();
        // invaliadate emit update, we can track it and update a soon as possible
        // need use lazy update, becuase every update will emit re-uppload
        this._updateInternal(this._model.lastDiff);
    }

    dispose() {
        this.attach(null);

        if (this._buffer) {
            this._buffer.destroy();
            this._buffer = null;
        }

        this._valid = false;
        this._model = null;
    }
}