import {Vector} from '../helpers.js';
import BaseRenderer from "./BaseRenderer.js";

export class BaseTexture3D {
    constructor(context, {
        width = 1,
        height = 1,
        depth = 1,
        type = 'u8',
        filter = 'nearest',
        data = null
    } = {}) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.offset = new Vector(0, 0, 0);
        this.minFilter = filter;
        this.magFilter = filter;
        this.type = type;
        this.data = data;

        this.context = context;
        this.id = BaseRenderer.ID++;
        this.dirty = true;
        this.prevLength = 0;

        this.regionsToUpdate = [];
        this.useSubRegions = false;
        this.ownerPool = null;
        this.isRegion = false;
        this.isEmpty = false;
        this.emptyRegion = null;

        /**
         * permanent location for base light texture in pool
         */
        this._poolLocation = -1;
    }

    upload() {
        this.context._textures[this.id] = this;
        this.dirty = false;
    }

    destroy() {
        delete this.context._textures[this.id];
    }

    update(data) {
        this.dirty = true;
        if (data) {
            this.data = data;
        }
    }

    bind() {
    }

    isSimilar() {
        return false;
    }
}

export class RegionTexture3D {
    constructor(context, {
        baseTexture = null,
        width = 0,
        height = 0,
        depth = 0,
        offset = new Vector(0, 0, 0),
        type = null,
        data = null,
    } = {}) {
        this.baseTexture = baseTexture;
        this.width = width || baseTexture.width;
        this.height = height || baseTexture.height;
        this.depth = depth || baseTexture.depth;
        this.offset = offset;
        this.type = type;
        this.data = data;
        this.allocated = false;

        this.context = context;
        this.id = BaseRenderer.ID++;
        this.dirty = data !== null;
        this.ownerPool = null;
        this.isRegion = true;
        this.isEmpty = false;
    }

    dispose() {
        this.allocated = false;
        this.dirty = false;
        this.data = null;
    }

    update(data) {
        if (!this.baseTexture.useSubRegions) {
            this.baseTexture.update(data);
            return;
        }

        this.allocated = true;
        if (!this.dirty) {
            this.dirty = true;
            this.baseTexture.dirty = true;
            this.baseTexture.regionsToUpdate.push(this);
        }
        this.data = data;
    }
}