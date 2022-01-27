export class BaseDataModel extends EventTarget {
    static MODEL_ID = 0;

    constructor() {
        super();

        this.id = BaseDataModel.MODEL_ID ++;

        // cache event
        this._invalidateEvent = new CustomEvent('invalidate', {
            detail: this,
        });
    }

    // dispath invalidate event
    invalidate () {
        this.dispatchEvent(this._invalidateEvent);
    }

    on (...args) {
        return this.addEventListener(...args);
    }

    off (...args) {
        return this.removeEventListener(...args);
    }
}

export class BaseDataModelHandler {
    static HANDLER_ID = 0;

    constructor() {
        this.id = BaseDataModelHandler.HANDLER_ID ++;

        this._model = null;

        this.onInvalidate = this.onInvalidate.bind(this);

        this._dirty = true;
    }

    /**
     * Attach model to handle
     * @param {BaseDataModel} model 
     */
    attach(model) {
        if (this._model === model) {
            return;
        }

        if (this._model) {
            this._model.removeEventListener('invalidate', this.onInvalidate);
        }

        this._model = model;

        if(model) {
            this._model.addEventListener('invalidate', this.onInvalidate);
        }
    }

    onInvalidate() {
        this._dirty = true;
    }

    update() {
        this._dirty = false;
    }
}