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
        this.minFilter = filter;
        this.magFilter = filter;
        this.type = type;
        this.data = data;

        this.context = context;
        this.id = BaseRenderer.ID++;
        this.dirty = true;
        this.prevLength = 0;

        this.regionsToUpdate = [];
        this.allowSubRegions = false;
        this.useSubRegions = false;
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

export class TextureRegion3D {
    constructor(context, {
        baseTexture = null,
        size = null,
        offset = null,
        type = null,
        data = null,
    } = {}) {
        this.baseTexture = baseTexture;
        this.width = size.x;
        this.height = size.y;
        this.depth = size.z;
        this.offset = offset;
        this.size = size;
        this.type = type;
        this.data = data;
        this.allocated = false;

        this.context = context;
        this.id = BaseRenderer.ID++;
        this.dirty = data !== null;
    }

    dispose() {
        this.allocated = false;
        this.dirty = false;
    }

    update(data) {
        if (!this.baseTexture.useSubRegions) {
            this.baseTexture.update(data);
        }

        this.allocated = true;
        if (!this.dirty) {
            this.baseTexture.regionsToUpdate.push(this);
        }
        this.dirty = true;
        if (data) {
            this.data = data;
        }
    }
}