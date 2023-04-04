import {ExportGeometry16} from "./ExportGeometry.js";
import {Resources} from "../resources.js";
import {BLOCK} from "../blocks.js";
import {chunkAddrToCoord, Helpers, Vector} from "../helpers.js";
import {ExportFluidHelper} from "../fluid/ExportFluidHelper.js";
import type { ChunkManager } from "../chunk_manager.js";

export class ChunkExporter {
    // [key: string]: any;
    chunkManager:   ChunkManager
    outJson:        any
    bufferViews:    any[];
    matMap:         Map<any, any>;
    texMap:         Map<any, any>;
    promises:       any[];
    accessors:      any[];
    fluidExporter:  ExportFluidHelper;
    terrain:        ExportGeometry16;

    constructor(chunkManager : ChunkManager) {
        this.chunkManager = chunkManager;

        this.reset();
    }

    getPalette() {
        const paletteImg = Resources.maskColor;
        const canvas = getCanvas();
        const width = canvas.width = paletteImg.width;
        const height = canvas.height = paletteImg.height;
        const context = canvas.getContext('2d');
        context.drawImage(paletteImg, 0, 0);
        const imageData = context.getImageData(0, 0, width, height);
        const uint32Array = new Uint32Array(width * height);
        const uint8Array = new Uint8Array(uint32Array.buffer);
        for (let i = 0; i < imageData.data.length; i++) {
            uint8Array[i] = imageData.data[i];
        }
        return {
            buf: uint32Array,
            width, height
        }
    }

    reset() {
        const sqrt2 = Math.sqrt(2) / 2;
        this.outJson = {
            images: [],
            textures: [],
            materials: [],
            bufferViews: [],
            accessors: [],
            meshes: [],
            nodes: [{
                children: [],
                // rotation: [-sqrt2, 0, 0, sqrt2]
            }],
            samplers: [
                {
                    "magFilter": WEBGL_CONSTANTS.NEAREST,
                    "minFilter": WEBGL_CONSTANTS.NEAREST,
                    "wrapS": WEBGL_CONSTANTS.CLAMP_TO_EDGE,
                    "wrapT": WEBGL_CONSTANTS.CLAMP_TO_EDGE,
                }
            ],
            asset : {
                generator : "Qubatch chunks glTF 2.0 exporter",
                version : "2.0"
            },
            scene : 0,
            scenes : [
                {
                    name : "Scene",
                    nodes : [
                        0
                    ]
                }
            ],
            buffers: [{ byteLength: 0, }]
        }
        this.bufferViews = [];
        this.matMap = new Map();
        this.texMap = new Map();
        this.promises = [];
        this.accessors = [];

        this.fluidExporter = new ExportFluidHelper();
    }

    addBufferView() {
        let bvData = {
            json: {
                buffer: 0,
                byteOffset: 0,
                byteLength: 0,
            },
            index: this.outJson.bufferViews.length,
            data: null
        }
        this.outJson.bufferViews.push(bvData.json)
        this.bufferViews.push(bvData);
        return bvData;
    }

    getOrCreateTexture(texture) {
        let texData = this.texMap.get(texture);
        if (texData) {
            return texData;
        }

        let tt = this.outJson.textures.length;
        const bvData = this.addBufferView();
        texData = {   // basic
            json: {
                sampler: 0,
                source: this.outJson.textures.length,
            },
            imageJson: {
                "bufferView": bvData.index,
                "mimeType": "image/png"
            },
            bvData,
            index: this.outJson.textures.length
        };
        this.texMap.set(texture, texData);
        let canvas = null
        if (texture.source instanceof Image
            || texture.source instanceof ImageBitmap
            || texture.source.getContext && texture.style.mipmap) {
            canvas = document.createElement('canvas');
            canvas.width = texture.source.width;
            canvas.height = texture.source.height;
            if (texture.style.mipmap) {
                canvas.width = texture.source.width / 2;
                canvas.height = texture.source.height / 2;
            }
            canvas.getContext('2d').drawImage(texture.source, 0, 0);
            // its an image
        } else if (texture.source.getContext) {
            // canvas
            canvas = texture.source;
        } else {
            texData.index = -1;
            return texData;
        }
        this.promises.push(new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                resolve(blob.arrayBuffer().then((res) => {
                    bvData.data = new Uint8Array(res);
                }));
            },  "image/png");
        }));

        this.outJson.textures.push(texData.json);
        this.outJson.images.push(texData.imageJson);

        return texData;
    }

    getOrCreateMaterial(resource_pack, key) {
        let matData = this.matMap.get(key);
        if (matData) {
            return matData;
        }
        // const shaderName = mat_shader === 'fluid' ? 'fluidShader' : 'shader';
        const mat = resource_pack.materials.get(key);
        if (!mat) {
            return null;
        }
        let tex = mat.texture || mat.shader.texture;
        let tex_n = mat.texture_n || mat.shader.texture_n;
        matData = {
            json: {
                name: key,
                doubleSided: !mat.cullFace,
                alphaMode: mat.opaque ? "MASK" : "BLEND",
            },
            index: this.outJson.materials.length,
            isFluid: !!mat.shader.fluidFlags,
        }
        if (matData.isFluid) {
            tex = this.fluidExporter.createFluidTexture(mat.opaque, tex.source);
            if (tex_n) {
                tex_n = this.fluidExporter.createFluidTexture(mat.opaque, tex_n.source);
            }
        }
        if (tex) {
            let num = this.getOrCreateTexture(tex).index;
            if (num >= 0) {
                matData.json.pbrMetallicRoughness = {
                    baseColorTexture: {
                        index: num,
                    },
                }
            }
        }
        if (tex_n) {
            let num = this.getOrCreateTexture(tex_n).index;
            if (num >= 0) {
                matData.json.normalTexture = {
                    index: num
                };
            }
        }
        this.matMap.set(key, matData);
        this.outJson.materials.push(matData.json);

        return matData;
    }

    packGeom(bvData, exportGeometry) {
        const data = exportGeometry.pack();
        bvData.data = new Uint8Array(data.buffer);
        bvData.json.target = WEBGL_CONSTANTS.ARRAY_BUFFER;
        bvData.json.byteStride = exportGeometry.vertexStrideFloats * 4;

        for (let i = 0; i < this.accessors.length; i++) {
            const attr = this.accessors[i];
            if (attr.json.bufferView === bvData.index && !attr.json.normalized) {
                calcMinMax(attr.json, data, attr, attr.json.count);
            }
        }
    }

    createQuadIndexBv(bvData, quads) {
        let indices = new Uint32Array(quads * 6);
        let j = 0;
        for (let i = 0; i < quads; i++) {
            indices[j++] = i * 4 + 0;
            indices[j++] = i * 4 + 1;
            indices[j++] = i * 4 + 2;
            indices[j++] = i * 4 + 0;
            indices[j++] = i * 4 + 2;
            indices[j++] = i * 4 + 3;
        }

        bvData.data = new Uint8Array(indices.buffer);
        bvData.json.target = WEBGL_CONSTANTS.ELEMENT_ARRAY_BUFFER;
    }

    encodeTerrainAccessors(bvData, geom, start, count) {
        let ind = this.outJson.accessors.length;

        let primitiveAttributes = {};

        for (let i = 0; i < geom.attributes.length; i++) {
            const attr = Object.assign({start, stride: geom.vertexStrideFloats}, geom.attributes[i]);
            attr.json = Object.assign({byteOffset: start * 4, count, bufferView: bvData.index, min: [0, 0, 0, 0], max: [255, 255, 255, 255]}, attr.json)
            start += attr.size;
            primitiveAttributes[attr.name] = ind++;
            this.accessors.push(attr);
            this.outJson.accessors.push(attr.json);
        }

        return primitiveAttributes;
    }

    encodeIndexAccessor(bvData, quads) {
        const ind = this.outJson.accessors.length;
        this.outJson.accessors.push({
            bufferView: bvData.index,
            componentType: WEBGL_CONSTANTS.UNSIGNED_INT,
            type: "SCALAR",
            min: [0],
            max: [quads * 4 - 1],
            count: quads * 6
        });
        return ind;
    }

    encode(camPos : Vector = new Vector(), name : string) {
        // all floats will go here
        const terrain = this.terrain = new ExportGeometry16();
        terrain.palette = this.getPalette();
        terrain.innerConvertFluid = this.fluidExporter.innerConvertFluid.bind(terrain);

        let localPos = new Vector();
        chunkAddrToCoord(this.chunkManager.grid.toChunkAddr(camPos), localPos);

        this.reset();

        const {spiral} = this.chunkManager.renderList;
        const {outJson} = this;

        let geomBvData = this.addBufferView();
        let indexBvData = this.addBufferView();
        let maxInstances = 0;
        for (let i = 0; i < spiral.entries.length; i++) {
            const chunk = spiral.entries[i].chunk;
            if (!chunk.chunkManager) {
                // destroyed!
                continue;
            }
            if (chunk.vertices_length === 0) {
                continue;
            }
            let mesh = null;
            let meshIndex = -1;
            for (let i = 0; i < chunk.verticesList.length; i++) {
                let chunkVert = chunk.verticesList[i];

                const rp = BLOCK.resource_pack_manager.list.get(chunkVert.resource_pack_id);
                const mat = this.getOrCreateMaterial(rp, chunkVert.key);
                if (!mat) {
                    continue;
                }
                const oldSize = terrain.size;
                if (mat.isFluid) {
                    terrain.pushFluidGeom(chunkVert.buffer, chunk);
                } else {
                    terrain.pushTerrainGeom(chunkVert.buffer, chunk);
                }
                const newSize = terrain.size;
                const instances = (newSize - oldSize);
                maxInstances = Math.max(instances, maxInstances);

                const attributes = this.encodeTerrainAccessors(geomBvData, terrain,
                    terrain.instanceStrideFloats * oldSize, instances * 4);
                const primitive = {
                    attributes,
                    indices: this.encodeIndexAccessor(indexBvData, instances),
                    material: mat.index,
                    mode: WEBGL_CONSTANTS.TRIANGLES,
                }
                if (!mesh) {
                    mesh = {
                        primitives: [primitive]
                    }
                    meshIndex = outJson.meshes.length;
                    outJson.meshes.push(mesh);
                } else {
                    mesh.primitives.push(primitive);
                }
            }
            if (mesh) {
                const node = {
                    mesh: meshIndex,
                    name: `chunk_${chunk.addr}`,
                    translation: [
                        (chunk.coord.x - localPos.x),
                        (chunk.coord.y - localPos.y),
                        -(chunk.coord.z - localPos.z),
                    ]
                }
                const nodeIndex = outJson.nodes.length;
                outJson.nodes[0].children.push(nodeIndex);
                outJson.nodes.push(node);
            }
        }

        this.packGeom(geomBvData, terrain);
        this.createQuadIndexBv(indexBvData, maxInstances);


        return Promise.all(this.promises).then(() => {
            let sz = 0;
            for (let i = 0; i < this.bufferViews.length; i++) {
                const bvData = this.bufferViews[i];
                bvData.json.byteOffset = sz;
                bvData.json.byteLength = bvData.data.byteLength;
                sz += bvData.json.byteLength;
            }
            sz += (4 - sz % 4) % 4;
            outJson.buffers[0].byteLength = sz;

            let jsonStr = JSON.stringify(outJson);
            let padCount = (4 - (jsonStr.length % 4));
            if (padCount !== 4) {
                let suffix = " ";
                for (let i = 1; i < padCount; i++) {
                    suffix += " ";
                }
                jsonStr += suffix;
            }
            let jsonChunk = new TextEncoder().encode(jsonStr);

            let fileSize = GLB_HEADER_BYTES
                + GLB_CHUNK_PREFIX_BYTES + jsonChunk.byteLength
                + GLB_CHUNK_PREFIX_BYTES + sz;
            let fileBin = new ArrayBuffer(fileSize);
            let view = new DataView(fileBin);
            view.setUint32(0, GLB_HEADER_MAGIC, true);
            view.setUint32(4, GLB_VERSION, true);
            view.setUint32(8, fileSize, true);

            let offset = GLB_HEADER_BYTES;
            view.setUint32(offset, jsonChunk.byteLength, true);
            view.setUint32(offset + 4, GLB_CHUNK_TYPE_JSON, true);
            offset += GLB_CHUNK_PREFIX_BYTES;
            let uint8View = new Uint8Array(fileBin);
            uint8View.set(jsonChunk, offset);
            offset += jsonChunk.byteLength;
            view.setUint32(offset, sz, true);
            view.setUint32(offset + 4, GLB_CHUNK_TYPE_BIN, true);
            offset += GLB_CHUNK_PREFIX_BYTES;
            for (let i = 0; i < this.bufferViews.length; i++) {
                uint8View.set(this.bufferViews[i].data, offset + this.bufferViews[i].json.byteOffset);
            }
            // here we have it, GLB file
            this.reset();
            Helpers.downloadBlobPNG(new Blob([uint8View]), `${name}.glb`)
        });
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

// GLB constants
// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#glb-file-format-specification

const GLB_HEADER_BYTES = 12;
const GLB_HEADER_MAGIC = 0x46546C67;
const GLB_VERSION = 2;

const GLB_CHUNK_PREFIX_BYTES = 8;
const GLB_CHUNK_TYPE_JSON = 0x4E4F534A;
const GLB_CHUNK_TYPE_BIN = 0x004E4942;

//------------------------------------------------------------------------------
// Utility functions
//------------------------------------------------------------------------------

/**
 * Compare two arrays
 * @param  {Array} array1 Array 1 to compare
 * @param  {Array} array2 Array 2 to compare
 * @return { boolean }        Returns true if both arrays are equal
 */
function equalArray(array1, array2) {

    return (array1.length === array2.length) && array1.every(function (element, index) {

        return element === array2[index];

    });

}

/**
 * Converts a string to an ArrayBuffer.
 * @param  {string} text
 * @return {ArrayBuffer}
 */
function stringToArrayBuffer(text) {

    return new TextEncoder().encode(text).buffer;

}

/**
 * Is identity matrix
 *
 * @param {Matrix4} matrix
 * @returns { boolean } Returns true, if parameter is identity matrix
 */
function isIdentityMatrix(matrix) {

    return equalArray(matrix.elements, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

}

/**
 * Get the min and max vectors from the given attribute
 */
function calcMinMax(out, array, attribute, count) {
    const {size, start, stride} = attribute;
    out.min = new Array(size).fill(Number.POSITIVE_INFINITY);
    out.max = new Array(size).fill(Number.NEGATIVE_INFINITY);
    for (let i = 0; i < count; i++) {
        for (let a = 0; a < size; a++) {
            let value = array[start + i * stride + a];
            out.min[a] = Math.min(out.min[a], value);
            out.max[a] = Math.max(out.max[a], value);
        }
    }
}

function getCanvas(): HTMLCanvasElement {

    //@ts-ignore
    if (typeof document === 'undefined' && typeof OffscreenCanvas !== 'undefined') {
        //@ts-ignore
        return new OffscreenCanvas(1, 1) as any;

    }

    return document.createElement('canvas');

}

function getToBlobPromise(canvas, mimeType) {

    if (canvas.toBlob !== undefined) {

        return new Promise((resolve) => canvas.toBlob(resolve, mimeType));

    }

    let quality;

    // Blink's implementation of convertToBlob seems to default to a quality level of 100%
    // Use the Blink default quality levels of toBlob instead so that file sizes are comparable.
    if (mimeType === 'image/jpeg') {

        quality = 0.92;

    } else if (mimeType === 'image/webp') {

        quality = 0.8;

    }

    return canvas.convertToBlob({

        type: mimeType,
        quality: quality

    });

}

