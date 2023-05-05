import {BaseTexture3D} from "../BaseTexture3D.js";

const TEXTURE_FILTER_GL = {
    'linear': 'LINEAR',
    'nearest': 'NEAREST'
}

const TEXTURE_WRAP_GL = {
    'clamp': 'CLAMP_TO_EDGE',
    'repeat': 'REPEAT'
}

const TEXTURE_TYPE_FORMAT = {
    'rgba8unorm': {
        format: 'RGBA', internal: 'RGBA8', type : 'UNSIGNED_BYTE'
    },
    'rgb565unorm': {
        format: 'RGB', internal: 'RGB565', type : 'UNSIGNED_SHORT_5_6_5',
        arrClass: Uint16Array, bytesPerElement: 2, elementPerPixel: 1,
    },
    'rgba4unorm': {
        format: 'RGBA', internal: 'RGBA4', type : 'UNSIGNED_SHORT_4_4_4_4',
        arrClass: Uint16Array, bytesPerElement: 2,
    },
    'u8': {
        format: 'RED', internal: 'R8', type: 'UNSIGNED_BYTE', elementPerPixel: 1,
    },
    'rgba': {
        format: 'RGBA', type: 'UNSIGNED_BYTE',
    },
    'r32sint': {
        format: 'RED_INTEGER', internal: 'R32I', type: 'INT', elementPerPixel: 1,
    },
    'rgba32sint': {
        format: 'RGBA_INTEGER', internal: 'RGBA32I', type: 'INT'
    },
    'rgba8uint': {
        format: 'RGBA_INTEGER', internal: 'RGBA8UI', type: 'UNSIGNED_BYTE'
    },
    'rgba32uint': {
        format: 'RGBA_INTEGER', internal: 'RGBA32UI', type: 'UNSIGNED_INT'
    },
}

export class WebGLTexture3D extends BaseTexture3D {
    [key: string]: any;
    constructor(context, options) {
        super(context, options);
    }

    bind(location = 0) {
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

        if (this.fixedSize) {
            if (this.prevLength === 0) {
                gl.texStorage3D(target, 1, gl[formats.internal || formats.format],
                    this.innerWidth, this.innerHeight, this.innerDepth);
                if (data) {
                    this.prevLength = data.length;
                } else {
                    this.prevLength = this.innerWidth * this.innerHeight * this.innerDepth * (formats.elementPerPixel || 4);
                }
                this.updateStyle();
            } else if (data && this.prevLength !== data.length) {
                console.warn('Texture3D resize fail');
                return;
            }
        }
        if (this.useSubRegions) {
            this.uploadSubs();
        } else if (data) {
            if (this.prevLength !== data.length) {
                // SHOULD NOT HAPPEN
                this.prevLength = data.length;
                gl.texImage3D(target, 0, gl[formats.internal || formats.format],
                    this.innerWidth, this.innerHeight, this.innerDepth,
                    0, gl[formats.format], gl[formats.type], data);
                this.updateStyle();
            } else {
                gl.texSubImage3D(target, 0, 0, 0, 0,
                    this.innerWidth, this.innerHeight, this.innerDepth,
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
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl[TEXTURE_FILTER_GL[this.wrap]] || gl.CLAMP_TO_EDGE);
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl[TEXTURE_FILTER_GL[this.wrap]] || gl.CLAMP_TO_EDGE);
    }

    uploadSubs() {
        const { gl } = this.context;
        const { pixelSize } = this;

        const formats = TEXTURE_TYPE_FORMAT[this.type];

        const target = gl.TEXTURE_3D;
        const sz = this.innerWidth * this.innerHeight * this.innerDepth * (formats.elementPerPixel || 4);
        if (this.prevLength !== sz) {
            this.prevLength = sz;
            gl.texImage3D(target, 0, gl[formats.internal || formats.format],
                this.innerWidth, this.innerHeight, this.innerDepth,
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
                gl.texSubImage3D(target, 0,
                    region.offset.x / pixelSize, region.offset.y / pixelSize, region.offset.z / pixelSize,
                    region.width / pixelSize, region.height / pixelSize, region.depth / pixelSize,
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
