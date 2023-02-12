// export interface IChunkBatchSettings {
//     maxLightTextures: number;
//     maxChunks: number;
//     emptyTex3D: Texture3D;
// }

// export interface IBatchableChunk {
//     getLightTexture(): RegionTexture3D
//     _batchEnabled: number;
//     _batchLocation: number;
//     coord: Vector3;
// }

/**
 * copied from PixiJS
 */
export class ChunkBatch {
    constructor() {
        this.lightTextures = [];
        this.lightTextureCount = 0;
        this.chunks = [];
        this.chunkTexBind = [];
        this.chunkCount = 0;
        this.id = 0;
        this.settings = null;
    }

    init(settings, id) {
        this.settings = settings;
        this.id = id;
    }

    clear()
    {
        for (let i = 0; i < this.lightTextureCount; i++)
        {
            this.lightTextures[i] = null;
        }
        this.lightTextureCount = 0
        for (let i = 0; i < this.chunkCount; i++)
        {
            this.chunks[i] = null;
            this.chunkTexBind[i] = null;
        }
        this.chunkCount = 0;
        this.id = 0;
        this.settings = null;
    }

    add(chunk)
    {
        const { id, settings } = this;
        if (chunk._batchEnabled === id) {
            return chunk._batchEnabled;
        }
        if (this.chunkCount >= settings.maxChunks) {
            return -1;
        }
        const { lightTextures, lightTextureCount, chunks, chunkTexBind, chunkCount } = this;
        const { lightTex } = chunk;

        //TODO: fix this base stuff
        const base = lightTex ? (lightTex.baseTexture || lightTex ) : settings.emptyTex3D;

        if (base._batchEnabled !== this.id) {
            if (lightTextureCount >= settings.maxLightTextures) {
                return -1;
            }
            lightTextures[lightTextureCount] = base;
            base._batchEnabled = id;
            base._batchLocation = lightTextureCount;
            this.lightTextureCount++;
        }

        chunks[chunkCount] = chunk;
        chunkTexBind[chunkCount] = base._batchLocation;
        this.chunkCount++;
        return chunkCount;
    }
}