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