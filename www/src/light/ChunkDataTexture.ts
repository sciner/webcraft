export class ChunkDataTexture {
    [key: string]: any;
    constructor() {
        this.chunks = [];
        this.keepAlive = [];
        this.freeChunkTimeMs = 10000;
        this.total = 0;
        this.tex = null;
        this.pixelsPerChunk = 2;

        this.data = null;
        this.size = 0;
        this.resize(16);

        this.currentChunkIndex = 0;
    }

    resize(newSize) {
        this.size = newSize;
        const oldData = this.data;
        this.data = new Int32Array(newSize * newSize * 4);
        // assume that size always divisible by pixelsPerChunk
        this.chunks.length = newSize * (newSize / this.pixelsPerChunk);
        this.keepAlive.length = this.chunks.length;
        if (this.tex) {
            this.tex.resource.data = this.data;
            this.tex.setSize(newSize, newSize, 1);
        }

        if (oldData) {
            this.data.set(oldData, 0);
        }
    }

    add(chunkLight) {
        if (chunkLight._dataTexture) {
            //WTF
            return;
        }
        chunkLight._dataTexture = this;

        const {chunks, pixelsPerChunk, keepAlive, freeChunkTimeMs} = this;

        let cur = this.currentChunkIndex;

        if (this.total === chunks.length) {
            cur = chunks.length;
            // resize
            this.resize(Math.ceil(this.size * Math.sqrt(2) / pixelsPerChunk) * pixelsPerChunk);
        } else {
            const maxTime = performance.now() - freeChunkTimeMs;
            let repeat = 0;
            while (repeat < chunks.length) {
                if (!chunks[cur]) {
                    if (!keepAlive[cur] || keepAlive[cur] < maxTime) {
                        break;
                    }
                }
                cur = (cur + 1) % chunks.length
                repeat++
            }
            if (!chunks[cur] && (!keepAlive[cur] || keepAlive[cur] < maxTime)) {
                // ok
            } else {
                cur = chunks.length;
                this.resize(Math.ceil(this.size * Math.sqrt(2) / pixelsPerChunk) * pixelsPerChunk);
            }
        }
        chunks[cur] = chunkLight;
        this.currentChunkIndex = cur;
        chunkLight._dataTextureOffset = cur;
        chunkLight._dataTextureDirty = true;
        this.total++;
    }

    remove(chunkLight) {
        if (!chunkLight._dataTexture) {
            //WTF
            return;
        }
        chunkLight._dataTexture = null;
        this.chunks[chunkLight._dataTextureOffset] = null;
        this.keepAlive[chunkLight._dataTextureOffset] = performance.now();
        this.total--;
    }

    getTexture(BufferBaseTexture: any) {
        if (this.tex) {
            return this.tex;
        }
        this.tex = new BufferBaseTexture({
            format: 'rgba32sint',
            data: this.data,
            width: this.size,
            height: this.size,
            magFilter: 'nearest',
            minFilter: 'nearest',
        });
        return this.tex;
    }

    writeChunkData(chunkLight) {
        const { data } = this;
        const { coord, size } = chunkLight.parentChunk;
        const ind = chunkLight._dataTextureOffset * 4 * this.pixelsPerChunk;
        chunkLight._dataTextureDirty = false;

        data[ind + 0] = coord.x;
        data[ind + 1] = coord.y;
        data[ind + 2] = coord.z;
        data[ind + 3] = size.x | (size.z << 8) | (size.y << 16);

        const { lightTex } = chunkLight;

        if (lightTex) {
            const { layout } = lightTex;
            const base = lightTex.baseTexture || lightTex;
            data[ind + 4] = (layout.width << 16) + layout.x;
            data[ind + 5] = (layout.height << 16) + layout.y;
            data[ind + 6] = (layout.depth << 16) + layout.z;
            data[ind + 7] = base._poolLocation;
        } else{
            data[ind + 4] = data[ind + 5] = data[ind + 6] = 1;
            data[ind + 7] = 0;
        }
        if (this.tex) {
            this.tex.update();
        }
    }
}