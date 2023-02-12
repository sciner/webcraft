import {BaseTexture3D} from "../BaseTexture3D.js";

const TEXTURE_FILTER_GL = {
    'linear': 'LINEAR',
    'nearest': 'NEAREST'
}

const TEXTURE_TYPE_FORMAT = {
    'rgba8unorm': {
        format: 'RGBA', type : 'UNSIGNED_BYTE'
    },
    'rgb565unorm': {
        format: 'RGB', internal: 'RGB565', type : 'UNSIGNED_SHORT_5_6_5',
        arrClass: Uint16Array, bytesPerElement: 2,
    },
    'rgba4unorm': {
        format: 'RGBA', internal: 'RGBA4', type : 'UNSIGNED_SHORT_4_4_4_4',
        arrClass: Uint16Array, bytesPerElement: 2,
    },
    'u8': {
        format: 'ALPHA', type: 'UNSIGNED_BYTE',
    },
    'rgba': {
        format: 'RGBA', type: 'UNSIGNED_BYTE',
    }
}

export class WebGLTexture3D extends BaseTexture3D {
    constructor(context, options) {
        super(context, options);
    }

    bind(location) {
        location = location || 0;
        const {
            gl
        } = this.context;
        gl.activeTexture(gl.TEXTURE0 + location);
        if (this.dirty) {
            return this.upload();
        }
        const {
            texture
        } = this;
        gl.bindTexture(gl.TEXTURE_3D, texture);
    }

    upload() {
        const { gl } = this.context;
        const { data } = this;
        /**
         * @type {WebGLTexture}
         */
        this.texture = this.texture || gl.createTexture();
        const target = gl.TEXTURE_3D;
        gl.bindTexture(target, this.texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        const formats = TEXTURE_TYPE_FORMAT[this.type];

        if (this.useSubRegions) {
            this.uploadSubs();
        } else {
            if (this.prevLength !== data.length) {
                this.prevLength = data.length;
                gl.texImage3D(target, 0, gl[formats.internal || formats.format],
                    this.width, this.height, this.depth,
                    0, gl[formats.format], gl[formats.type], data);
                this.updateStyle();
            } else {
                gl.texSubImage3D(target, 0, 0, 0, 0,
                    this.width, this.height, this.depth,
                    gl[formats.format], gl[formats.type], data);
            }
        }
        super.upload();
    }

    updateStyle() {
        const { gl } = this.context;
        const target = gl.TEXTURE_3D;
        gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl[TEXTURE_FILTER_GL[this.minFilter]] || gl.NEAREST);
        gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl[TEXTURE_FILTER_GL[this.magFilter]] || gl.NEAREST);
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    uploadSubs() {
        const { gl } = this.context;

        const formats = TEXTURE_TYPE_FORMAT[this.type];

        const target = gl.TEXTURE_3D;
        const sz = this.width * this.height * this.depth * (formats.bytesPerElement || 4);
        if (this.prevLength !== sz) {
            this.prevLength = sz;
            gl.texImage3D(target, 0, gl[formats.internal || formats.format],
                this.width, this.height, this.depth,
                0, gl[formats.format], gl[formats.type],
                    null);
            this.updateStyle();
        }

        for (let i=0;i<this.regionsToUpdate.length;i++) {
            const region = this.regionsToUpdate[i];
            if (!region.dirty) {
                continue;
            }
            region.dirty = false;
            if (!region.isEmpty) {
                gl.texSubImage3D(target, 0, region.offset.x, region.offset.y, region.offset.z,
                    region.width, region.height, region.depth,
                    gl[formats.format], gl[formats.type], region.data);
                region.data = null;
            }
        }
        this.regionsToUpdate.length = 0;
    }

    destroy() {
        if (!this.texture) {
            return;
        }
        const  { gl } = this.context;
        gl.deleteTexture(this.texture);
        this.texture = null;
        this.source = null;
        this.width = this.height = this.depth = 0;
        super.destroy();
    }
}
