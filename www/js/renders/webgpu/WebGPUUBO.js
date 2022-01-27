import { BaseUBO } from "../UBO.js";
import { BaseDataModelHandler } from "../BaseDataModel.js";
import { WebGPUBuffer } from "./WebGPUBuffer.js";
import WebGPURenderer from "./index.js";

/**
 * WebGPU UBO implementation
 */
export class WebGPUUBO extends BaseDataModelHandler {
    /**
     * 
     * @param {WebGPURenderer} context 
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
         * @type {WebGPUBuffer}
         */
        this._buffer = null;

        this.updateId = -1;

        this.bindingIndex = bindingIndex;

        this.onInvalidate = this.onInvalidate.bind(this);
    }

    get size() {
        return this._model.fullSize;
    }

    get nativeBuffer() {
        return this._buffer.buffer;
    }

    /**
     * 
     * @param {BaseUBO} model 
     */
    attach(model) {
        if (model == this._model) {
            return;
        }

        super.attach(model);

        if (model === null) {
            this.dispose();
            return;
        }

        this._size = model.size;

        if (!this._buffer) {
            this._buffer = this.context.createBuffer({
                type  : 'uniform',
                usage : 'dynamic',
                data  : this._model.view,
                size  : Math.ceil(4 * model.fullSize / this.alligment) * this.alligment
            });
        }

        this._valid = true;
        this._buffer.dirty = true;
        this._buffer.update();
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

        this._buffer.dirty = true;
        this._buffer.update();

        this.updateId = state.updateId;
        this._dirty = false;

        super.update();
    }

    onInvalidate () {
        super.onInvalidate();
        // invaliadate emit update, we can track it and update a soon as possible
        // need use lazy update, becuase every update will emit re-uppload
        //this._updateInternal(this._model.lastDiff);

        this._dirty = true;
        this._buffer.dirty = true;
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