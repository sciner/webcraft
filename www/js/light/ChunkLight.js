import {Vector} from "../helpers.js";
import {FLUID_TYPE_MASK, fluidLightPower} from "../fluid/FluidConst.js";
import {BLOCK} from "../blocks.js";

export class ChunkLight {
    constructor(parentChunk) {
        this.parentChunk = parentChunk;
        this.lightTex = null;
        this.tblocks = null;
        this._dataTexture = null;
        this._dataTextureOffset = -1;
        this._dataTextureDirty = false;
        this._tempLightSource = null;
        this.lightData = null;

        this.currentDelta = [];
    }

    onGenerated(args) {
        const chunk = this.parentChunk;
        const chunkManager = chunk.chunkManager;
        const lp = chunkManager.lightProps;
        const arrClass = lp.texFormat === 'rgb565unorm' || lp.texFormat === 'rgba4unorm'
            ? Uint16Array : Uint8Array;
        this.lightData = args.lightmap_buffer ? new arrClass(args.lightmap_buffer) : null;
        chunk.tblocks.lightData = this.lightData;
        if (this.lightTex !== null) {
            this.lightTex.update(this.lightData)
        }
    }

    getChunkManager() {
        return this.parentChunk.chunkManager;
    }

    init() {
        const chunk = this.parentChunk;
        const chunkManager = chunk.chunkManager;
        if (!chunkManager.use_light) {
            return false;
        }
        chunkManager.postLightWorkerMessage(['createChunk',
            {
                addr: chunk.addr,
                size: chunk.size,
                uniqId: chunk.uniqId,
                light_buffer: this.genLightSourceBuf().buffer,
                dataId: this.getDataTextureOffset()
            }]);
    }

    getDataTextureOffset() {
        if (!this._dataTexture) {
            const cm = this.getChunkManager();
            cm.chunkDataTexture.add(this);
        }

        return this._dataTextureOffset;
    }

    prepareRender() {
        this.getDataTextureOffset();
        if (this._dataTextureDirty) {
            this._dataTexture.writeChunkData(this);
        }
    }

    dispose() {
        if (this._dataTexture) {
            this._dataTexture.remove(this);
            this._dataTexture = null;
        }
    }

    genLightSourceBuf() {
        const chunk = this.parentChunk;
        const {size} = chunk;
        const sz = size.x * size.y * size.z;
        const light_source = new Uint8Array(sz);

        let ind = 0;
        let prev_block_id = Infinity, prev_fluid = Infinity;
        let light_power_number = 0;
        let block_material = null;

        const {cx, cy, cz, cw} = chunk.dataChunk;
        const {id} = chunk.tblocks;
        const fluid = chunk.fluid.uint16View;

        for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x = 0; x < size.x; x++) {
                    const index = cx * x + cy * y + cz * z + cw;
                    const block_id = id[index];
                    const fluid_type = fluid[index] & FLUID_TYPE_MASK;
                    if (block_id !== prev_block_id || fluid_type !== prev_fluid) {
                        block_material = BLOCK.BLOCK_BY_ID[block_id]
                        if (block_material) {
                            light_power_number = block_material.light_power_number;
                        } /*else {
                            console.error(`Block not found ${block_id}`);
                        }*/
                        if (fluid_type > 0) {
                            light_power_number |= fluidLightPower(fluid_type);
                        }

                        prev_block_id = block_id;
                        prev_fluid = fluid_type;
                    }

                    // dynamic light
                    if (block_material && block_material.is_dynamic_light) {
                        const tblock = chunk.getBlock(chunk.coord.x + x, chunk.coord.y + y, chunk.coord.z + z);
                        if (tblock) {
                            light_power_number = tblock.lightSource;
                        }
                    }

                    light_source[ind++] = light_power_number;
                }
        return light_source;
    }

    beginLightChanges() {
        const chunkManager = this.parentChunk.chunkManager;
        if (!chunkManager.use_light) {
            return;
        }
        this._tempLightSource = this.genLightSourceBuf();
    }

    endLightChanges() {
        const chunk = this.parentChunk;
        const chunkManager = chunk.chunkManager;
        if (!chunkManager.use_light) {
            return;
        }
        const oldBuf = this._tempLightSource;
        this._tempLightSource = null;
        const newBuf = this.genLightSourceBuf();

        const {size} = chunk;
        let diff = [];
        let ind = 0;
        for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x = 0; x < size.x; x++) {
                    if (oldBuf[ind] !== newBuf[ind]) {
                        diff.push(x, y, z, newBuf[ind]);
                    }
                    ind++;
                }
        if (diff.length > 0) {
            chunkManager.postLightWorkerMessage(['setChunkBlock', {
                addr: chunk.addr,
                dataId: this.getDataTextureOffset(),
                list: diff
            }]);
        }
    }

    applyDiffToLight(diffFluidType) {
        const chunk = this.parentChunk;
        const chunkManager = chunk.chunkManager;
        const diff = [];
        const {cw, outerSize } = chunk.dataChunk;
        let tblock = null;
        let v = new Vector();

        for (let i = 0; i < diffFluidType.length; i++) {
            const index = diffFluidType[i];
            let tmp = index - cw;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;
            v.set(x, y, z);
            tblock = chunk.tblocks.get(v, tblock);
            diff.push(x, y, z, tblock.lightSource);
        }
        if (diff.length > 0) {
            chunkManager.postLightWorkerMessage(['setChunkBlock', {
                addr: chunk.addr,
                dataId: this.getDataTextureOffset(),
                list: diff
            }]);
        }
    }

    flushDelta() {
        if (this.currentDelta.length > 0) {
            if (this.parentChunk.chunkManager.use_light) {
                this.applyDiffToLight(this.currentDelta);
            }
        }
        this.currentDelta.length = 0;
    }
}