export class TerrainSubGeometry {
    constructor({baseGeometry, pool, sizeQuads = 0, sizePages = 0}) {
        this.baseGeometry = baseGeometry;
        this.pool = pool;
        this.glOffsets = [];
        this.glCounts = [];
        this.pages = [];
        this.sizeQuads = sizeQuads;
        this.sizePages = sizePages;
    }

    setDataPages(vertices) {
        const {baseGeometry, pages, glOffsets, glCounts} = this;
        const {pageSize} = this.pool;
        this.sizeQuads = this.size = vertices[0];
        glOffsets.length = glCounts.length = 0;
        for (let i = 0; i < this.sizePages; i++) {
            const floatBuffer = new Float32Array(vertices[i + 1]);

            glOffsets.push(pages[i] * pageSize);
            glCounts.push(floatBuffer.length / baseGeometry.strideFloats);
            baseGeometry.updatePage(pages[i] * pageSize, floatBuffer);
        }
    }

    destroy() {
        if (!this.pool) {
            return;
        }
        this.pool.dealloc(this);
    }
}