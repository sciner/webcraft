import WebGLRenderer from "./index.js";
import { BaseUBO } from "../UBO.js";
import { WebGLBuffer } from "./WebGLBuffer.js";

export class WebGLAbstractionUBO {
    /**
     * 
     * @param {WebGLRenderer} context 
     */
    constructor (context, {bindingIndex = 0} = {}) {
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

        this._model = model;

        this._size = model.size;

        if (!this._buffer) {
            this._buffer = this.context.createBuffer({
                type: 'uniform',
                usage: 'dynamic',
            });
        }

        this._valid = true;

        this.update();

        const gl = this.context.gl;

        // bind UBO
        gl.bindBufferBase(gl.UNIFORM_BUFFER, this.bindingIndex, this._buffer.buffer);
    }

    update() {
        if (!this._valid) {
            return;
        }

        const state = this._model.update();

        if (state.updateId === this.updateId) {
            return;
        }

        const partial = (this.updateId + 1) === state.updateId;

        // we can partial update UBO buffer
        // because minor diff 

        if (partial && false) {
            this._buffer.update(
                this._model.data,
                state.start,
                state.end
            )
        } else {
            this._buffer.update(
                this._model.data,
                0,
                0
            )
        }

        this.updateId = state.updateId;
    }

    dispose() {
        if (this._buffer) {
            this._buffer.destroy();
            this._buffer = null;
        }

        this._valid = false;
        this._model = null;
    }
}