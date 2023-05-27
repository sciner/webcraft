import {WorkerGeometryPool} from "./worker_geometry_pool.js";
import {QUAD_FLAGS} from "../helpers.js";

export class BaseExportGeometry {
    [key: string]: any;
    constructor({
                    vertexStrideFloats,
                    instanceStrideFloats
                }) {
        this.vertexStrideFloats = vertexStrideFloats;
        this.instanceStrideFloats = instanceStrideFloats;
        this.pool = new WorkerGeometryPool(null, {
            pageSize: 256,
            pageCount: 0,
            instanceSize: this.instanceStrideFloats,
        });
        this.size = 0;
        this.bigData = null;
        this.lastPage = this.pool.allocPage();
        this.currentChunk = null;
    }

    pack() {
        const stride = this.instanceStrideFloats;
        const bigData = this.bigData = new Float32Array(this.size * this.instanceStrideFloats);
        const {pages} = this.pool;
        let ind = 0;
        for (let i = 0; i < pages.length; i++) {
            if (pages[i].filled === pages[i].sizeQuads) {
                bigData.set(pages[i].data, ind * stride);
            } else if (pages[i].filled > 0) {
                bigData.set(pages[i].data.slice(0, pages[i].filled * stride), ind * stride);
            }
            ind += pages[i].filled;
        }
        return bigData;
    }

    innerConvertPage(page, convertInstances, extraOffset = 0) {
        let offset = 0;
        let lastPage = this.lastPage;
        while (offset < page.filled) {
            const batchInstances = Math.min(page.filled - offset, lastPage.sizeQuads - lastPage.filled);
            convertInstances(lastPage, lastPage.filled, page, offset + extraOffset, batchInstances, this.currentChunk);
            lastPage.filled += batchInstances;
            this.size += batchInstances;
            offset += batchInstances;
            if (lastPage.filled === lastPage.sizeQuads) {
                lastPage = this.pool.allocPage();
            }
        }
        this.lastPage = lastPage;
    }
}

const quadData = new Float32Array([
    -.5, -.5, .5, -.5, .5, .5, -.5, .5
]);

export class ExportGeometry16 extends BaseExportGeometry {
    [key: string]: any;
    static options = {
        vertexStrideFloats: 16,
        instanceStrideFloats: 16 * 4,
    };
    innerConvertTerrain = (dstPage, dstOffset, srcPage, srcOffset, count, currentChunk) => {
        const {palette, vertexStrideFloats, instanceStrideFloats} = this;
        const srcBuf = srcPage.data;
        const srcUint = srcPage.uint32Data || new Uint32Array(srcBuf.buffer);
        const dstBuf = dstPage.data;
        const dstUint = dstPage.uint32Data;
        dstOffset *= instanceStrideFloats;
        srcOffset *= srcPage.instanceSize;
        const chunkId = currentChunk ?currentChunk.getDataTextureOffset() : srcUint[srcOffset + 15];
        for (let i = 0; i < count; i++) {

            //gltf space: X LEFT (reversed)
            //Y up
            //Z forward

            let cx = srcBuf[srcOffset + 0];
            let cy = srcBuf[srcOffset + 2];
            let cz = -srcBuf[srcOffset + 1];

            let dx0 = srcBuf[srcOffset + 3];
            let dy0 = srcBuf[srcOffset + 5];
            let dz0 = -srcBuf[srcOffset + 4];

            let dx1 = srcBuf[srcOffset + 6];
            let dy1 = srcBuf[srcOffset + 8];
            let dz1 = -srcBuf[srcOffset + 7];

            let nx = dy0 * dz1 - dy1 * dz0;
            let ny = dz0 * dx1 - dz1 * dx0;
            let nz = dx0 * dy1 - dx1 * dy0;
            const ndist = Math.hypot(nx, ny, nz);
            nx /= ndist;
            ny /= ndist;
            nz /= ndist;

            const cu = srcBuf[srcOffset + 9];
            const cv = srcBuf[srcOffset + 10];
            const su = srcBuf[srcOffset + 11];
            const sv = srcBuf[srcOffset + 12];

            const a_color = srcUint[srcOffset + 13];
            const flags = srcUint[srcOffset + 14];

            // tangent
            let tx = dx0, ty = dy0, tz = dz0, tw = su * sv > 0 ? 1 : -1;
            if (su < 0) {
                tx = -tx;
                ty = -ty;
                tz = -tz;
            }
            let tdist = Math.hypot(tx, ty, tz);
            tx /= tdist;
            ty /= tdist;
            tz /= tdist;

            if ((flags & QUAD_FLAGS.FLAG_MIR2_TEX) !== 0) {
                // implement triangle rotate
            }

            let color_R = a_color & 0x3ff, color_B = (a_color >> 10) & 0x3ff, color_G = (a_color >> 20);
            let color_mul = 0xffffffff, color_add = 0x0;
            if ((flags & QUAD_FLAGS.FLAG_MASK_BIOME) > 0) {
                color_add = palette.buf[color_B * palette.width + color_R];
            } else if ((flags & QUAD_FLAGS.FLAG_MULTIPLY_COLOR) > 0) {
                color_mul = palette.buf[color_B * palette.width + color_R];
            }

            for (let vert = 0; vert < 4; vert++) {
                const s = quadData[vert * 2], t = quadData[vert * 2 + 1];
                let x = cx + s * dx0 + t * dx1;
                let y = cy + s * dy0 + t * dy1;
                let z = cz + s * dz0 + t * dz1;

                dstBuf[dstOffset + 0] = x;
                dstBuf[dstOffset + 1] = y;
                dstBuf[dstOffset + 2] = z;
                dstBuf[dstOffset + 3] = nx;
                dstBuf[dstOffset + 4] = ny;
                dstBuf[dstOffset + 5] = nz;
                dstBuf[dstOffset + 6] = tx;
                dstBuf[dstOffset + 7] = ty;
                dstBuf[dstOffset + 8] = tz;
                dstBuf[dstOffset + 9] = tw;
                dstBuf[dstOffset + 10] = cu + s * su;
                dstBuf[dstOffset + 11] = cv + t * sv;
                dstUint[dstOffset + 12] = color_mul;
                dstUint[dstOffset + 13] = color_add;
                dstBuf[dstOffset + 14] = flags;
                dstBuf[dstOffset + 15] = chunkId;

                dstOffset += vertexStrideFloats;
            }

            //TODO: reverse normal or not?
            srcOffset += srcPage.instanceSize;
        }
    }

    pushTerrainGeom(geom, chunk) {
        this.currentChunk = chunk;
        if (geom.baseGeometry) {
            if (geom.glCounts) {
                let tmpPage = {
                    filled: 0,
                    instanceSize: geom.baseGeometry.strideFloats,
                    data: geom.baseGeometry.data,
                    uint32Data: new Uint32Array(geom.baseGeometry.data.buffer),
                }
                for (let i = 0; i < geom.glCounts.length; i++) {
                    tmpPage.filled = geom.glCounts[i];
                    this.innerConvertPage(tmpPage, this.innerConvertTerrain, geom.glOffsets[i]);
                }
            } else {
                for (let i = 0; i < geom.pages.length; i++) {
                    this.innerConvertPage(geom.pages[i], this.innerConvertTerrain);
                }
            }
        } else {
            this.innerConvertPage(geom, this.innerConvertTerrain);
        }
        this.currentChunk = null;
    }

    pushFluidGeom(geom, chunk) {
        if (!this.innerConvertFluid) {
            return;
        }
        this.currentChunk = chunk;
        if (geom.glCounts) {
            let tmpPage = {
                filled: 0,
                instanceSize: geom.baseGeometry.strideFloats,
                data: geom.baseGeometry.data,
                uint32Data: new Uint32Array(geom.baseGeometry.data.buffer),
            }
            for (let i = 0; i < geom.glCounts.length; i++) {
                tmpPage.filled = geom.glCounts[i];
                this.innerConvertPage(tmpPage, this.innerConvertFluid, geom.glOffsets[i]);
            }
        } else {
            for (let i = 0; i < geom.pages.length; i++) {
                this.innerConvertPage(geom.pages[i], this.innerConvertFluid);
            }
        }
        this.currentChunk = null;
    }

    constructor() {
        super(ExportGeometry16.options);
        this.palette = {
            buf: null,
            width: 0,
        }
        this.currentChunk = null;
        this.innerConvertFluid = null;

        this.createAttributes()
    }

    createAttributes() {
        let base = {
            componentType: WEBGL_CONSTANTS.FLOAT,
        }
        let norm = {
            componentType: WEBGL_CONSTANTS.UNSIGNED_BYTE, normalized: true
        }

        this.attributes = [
            {name: "POSITION", size: 3, json: Object.assign({type: "VEC3"}, base)},
            {name: "NORMAL", size: 3, json: Object.assign({type: "VEC3"}, base)},
            {name: "TANGENT", size: 4, json: Object.assign({type: "VEC4"}, base)},
            {name: "TEXCOORD_0", size: 2, json: Object.assign({type: "VEC2"}, base)},
            {name: "COLOR_0", size: 1, json: Object.assign({type: "VEC4"}, norm)},
            {name: "COLOR_1", size: 1, json: Object.assign({type: "VEC4"}, norm)},
            {name: "_FLAGS", size: 1, json: Object.assign({type: "SCALAR"}, base)},
            {name: "_CHUNK_ID", size: 1, json: Object.assign({type: "SCALAR"}, base)},
        ]
    }
}

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------

const WEBGL_CONSTANTS = {
    POINTS: 0x0000,
    LINES: 0x0001,
    LINE_LOOP: 0x0002,
    LINE_STRIP: 0x0003,
    TRIANGLES: 0x0004,
    TRIANGLE_STRIP: 0x0005,
    TRIANGLE_FAN: 0x0006,

    UNSIGNED_BYTE: 0x1401,
    UNSIGNED_SHORT: 0x1403,
    FLOAT: 0x1406,
    UNSIGNED_INT: 0x1405,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,

    NEAREST: 0x2600,
    LINEAR: 0x2601,
    NEAREST_MIPMAP_NEAREST: 0x2700,
    LINEAR_MIPMAP_NEAREST: 0x2701,
    NEAREST_MIPMAP_LINEAR: 0x2702,
    LINEAR_MIPMAP_LINEAR: 0x2703,

    CLAMP_TO_EDGE: 33071,
    MIRRORED_REPEAT: 33648,
    REPEAT: 10497
};