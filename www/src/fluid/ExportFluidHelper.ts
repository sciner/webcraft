import {QUAD_FLAGS, Vector} from "../helpers.js";
import {fluidMaterials} from "./FluidBuildVertices.js";

const cubeNorm = [
    new Vector(0.0, 0.0, 1.0),
    new Vector(0.0, 0.0, -1.0),
    new Vector(0.0, -1.0, 0.0),
    new Vector(0.0, 1.0, 0.0),
    new Vector(1.0, 0.0, 0.0),
    new Vector(-1.0, 0.0, 0.0)
];

const cubeVert = [
// up
    new Vector(0.0, 1.0, 1.0),
    new Vector(1.0, 1.0, 1.0),
    new Vector(1.0, 0.0, 1.0),
    new Vector(0.0, 0.0, 0.0),
// down
    new Vector(0.0, 1.0, 0.0),
    new Vector(1.0, 1.0, 0.0),
    new Vector(1.0, 0.0, 0.0),
    new Vector(0.0, 0.0, 0.0),
    // south
    new Vector(0.0, 0.0, 1.0),
    new Vector(1.0, 0.0, 1.0),
    new Vector(1.0, 0.0, 0.0),
    new Vector(0.0, 0.0, 0.0),
    // north
    new Vector(1.0, 1.0, 1.0),
    new Vector(0.0, 1.0, 1.0),
    new Vector(0.0, 1.0, 0.0),
    new Vector(1.0, 1.0, 0.0),
    // east
    new Vector(1.0, 0.0, 1.0),
    new Vector(1.0, 1.0, 1.0),
    new Vector(1.0, 1.0, 0.0),
    new Vector(1.0, 0.0, 0.0),
    // west
    new Vector(0.0, 1.0, 1.0),
    new Vector(0.0, 0.0, 1.0),
    new Vector(0.0, 0.0, 0.0),
    new Vector(0.0, 1.0, 0.0)
];

export class ExportFluidHelper {
    [key: string]: any;
    constructor() {
        // this.vertexStrideFloats = 16;
        // this.instanceStrideFloats = 16 * 4;
    }
    createFluidTexture(isOpaque, origSrc) {
        const canvas = document.createElement('canvas');
        const tile = 32;
        const texture = {
            source: canvas,
            width: tile,
            height: tile,
            style: {}
        }
        canvas.width = tile;
        canvas.height = tile;
        canvas.getContext('2d').drawImage(origSrc, isOpaque ? tile : 0, 0, tile, tile, 0, 0, tile, tile);
        return texture;
    }

    innerConvertFluid(dstPage, dstOffset, srcPage, srcOffset, count, currentChunk) {
        // THIS is bound to TERRAIN obj
        const {vertexStrideFloats, instanceStrideFloats} = this;
        const {palette} = this;
        const srcBuf = srcPage.data;
        const srcUint = srcPage.uint32Data || new Uint32Array(srcBuf.buffer);
        const dstBuf = dstPage.data;
        const dstUint = dstPage.uint32Data;
        dstOffset *= instanceStrideFloats;
        srcOffset *= srcPage.instanceSize;
        const chunkId = currentChunk ? currentChunk.getDataTextureOffset() : (srcUint[srcOffset] >> 16);
        const subPos = new Vector();
        const epsMul = new Vector();

        for (let i = 0; i < count; i++) {
            //gltf space: X LEFT (reversed)
            //Y up
            //Z forward
            let blockId = srcUint[srcOffset + 0] & 0xffff;
            const {outerSize, cw} = currentChunk.dataChunk;
            blockId -= cw;
            let cx = blockId % outerSize.x;
            blockId = (blockId - cx) / outerSize.x;
            let cz = blockId % outerSize.z;
            let cy = (blockId - cz) / outerSize.z;

            let fluidId = srcUint[srcOffset + 1];
            let cubeSide = (fluidId >> 2) & 0x7;
            let epsShift = (fluidId >> 5);
            fluidId &= 0x3;

            const fluidMat = fluidMaterials[fluidId];
            const {flags} = fluidMat;

            let a_color = srcUint[srcOffset + 2];
            let color_R = a_color & 0x3ff, color_B = (a_color >> 10) & 0x3ff, color_G = (a_color >> 20);
            let color_mul = 0xffffffff, color_add = 0x0;
            if ((flags & QUAD_FLAGS.MASK_BIOME) > 0) {
                color_add = palette.buf[color_B * palette.width + color_R];
            } else if ((flags & QUAD_FLAGS.FLAG_MULTIPLY_COLOR) > 0) {
                color_mul = palette.buf[color_B * palette.width + color_R];
            }

            for (let vert = 0; vert < 4; vert++) {
                subPos.copyFrom(cubeVert[cubeSide * 4 + vert]);
                subPos.z = srcBuf[srcOffset + 3];

                if (epsShift > 0) {
                    for (let i = 0; i < 6; i++) {
                        // EPS correction
                        if ((epsShift & (1 << i)) > 0
                            && (subPos.x - 0.1) * cubeNorm[i].x + (subPos.y - 0.1) * cubeNorm[i].y + (subPos.z - 0.1) * cubeNorm[i].z > 0.0) {
                            subPos.addSelf(epsMul.copyFrom(cubeNorm[i]).multiplyScalarSelf(0.01));
                        }
                    }
                }

                let u = 0, v = 0;


                let nx = cubeNorm[cubeSide].x;
                let ny = cubeNorm[cubeSide].y;
                let nz = cubeNorm[cubeSide].z;
                let tx = 0, ty = 0, tz = 0, tw = 1;

                //TODO: fix water tangents orientation
                if (cubeSide === 2 || cubeSide === 3) {
                    u = subPos.x;
                    v = subPos.z;
                    tx = cubeSide === 2 ? 1 : -1;
                } else if (cubeSide === 4 || cubeSide === 5) {
                    u = subPos.y;
                    v = subPos.z;
                    tz = cubeSide === 4 ? 1 : -1;
                } else {
                    u = subPos.x;
                    v = subPos.y;
                    tx = 1;
                    tw = cubeSide === 0 ? 1 : -1;
                }

                dstBuf[dstOffset + 0] = cx + subPos.x;
                dstBuf[dstOffset + 1] = cy + subPos.z;
                dstBuf[dstOffset + 2] = -(cz + subPos.y);
                dstBuf[dstOffset + 3] = nx;
                dstBuf[dstOffset + 4] = -nz;
                dstBuf[dstOffset + 5] = ny;
                dstBuf[dstOffset + 6] = tx;
                dstBuf[dstOffset + 7] = tz;
                dstBuf[dstOffset + 8] = -ty;
                dstBuf[dstOffset + 9] = tw;
                dstBuf[dstOffset + 10] = u;
                dstBuf[dstOffset + 11] = v;
                dstUint[dstOffset + 12] = color_mul;
                dstUint[dstOffset + 13] = color_add;
                dstBuf[dstOffset + 14] = flags;
                dstBuf[dstOffset + 15] = chunkId;

                dstOffset += vertexStrideFloats;
                srcOffset += srcPage.instanceSize / 4;
            }
            /**
             * execute part of our fluid shader here
             */
        }
    }
}