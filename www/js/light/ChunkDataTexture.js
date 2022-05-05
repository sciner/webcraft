export class ChunkDataTexture {
    constructor() {
        this.chunks = [];
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
        if (this.tex) {
            this.tex.source = this.data;
            this.tex.width = newSize;
            this.tex.height = newSize;
        }

        if (oldData) {
            this.data.set(oldData, 0);
        }
    }

    add(chunk) {
        if (chunk._dataTexture) {
            //WTF
            return;
        }
        chunk._dataTexture = this;

        const {chunks, pixelsPerChunk} = this;

        let cur = this.currentChunkIndex;

        if (this.total === chunks.length) {
            cur = chunks.length;
            // resize
            this.resize(Math.ceil(this.size * Math.sqrt(2) / pixelsPerChunk) * pixelsPerChunk);
        } else {
            let repeat = 0;
            while (repeat < chunks.length) {
                if (!chunks[cur]) {
                    break;
                }
                cur = (cur + 1) % chunks.length
                repeat++
            }
            if (chunks[cur]) {
                //WTF? total is wrong
            }
        }
        chunks[cur] = chunk;
        this.currentChunkIndex = cur;
        chunk._dataTextureOffset = cur;
        chunk._dataTextureDirty = true;
        this.total++;
    }

    remove(chunk) {
        if (!chunk._dataTexture) {
            //WTF
            return;
        }
        chunk._dataTexture = null;
        this.chunks[chunk._dataTextureOffset] = null;
        this.total--;
    }

    getTexture(render) {
        if (this.tex) {
            return this.tex;
        }
        this.tex = render.createTexture({
            type: 'rgba32sint',
            source: this.data,
            width: this.size,
            height: this.size,
            magFilter: 'nearest',
            minFilter: 'nearest',
        });
        return this.tex;
    }

    writeChunkData(chunk) {
        const { data } = this;
        const ind = chunk._dataTextureOffset * 4 * this.pixelsPerChunk;
        chunk._dataTextureDirty = false;

        data[ind + 0] = chunk.coord.x;
        data[ind + 1] = chunk.coord.y;
        data[ind + 2] = chunk.coord.z;
        data[ind + 3] = 0;

        const { lightTex } = chunk;

        if (lightTex) {
            const base = lightTex.baseTexture || lightTex;
            data[ind + 4] = (lightTex.width << 16) + lightTex.offset.x;
            data[ind + 5] = (lightTex.height << 16) + lightTex.offset.y;
            data[ind + 6] = (lightTex.depth << 16) + lightTex.offset.z;
            data[ind + 7] = base._poolLocation;
        } else{
            data[ind + 4] = data[ind + 5] = data[ind + 6] = 1;
            data[ind + 7] = 0;
        }
        if (this.tex) {
            this.tex.dirty = true;
        }
    }
}