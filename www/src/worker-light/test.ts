//TODO: recover tests

/**
 *
 * @returns {boolean}
 */

function testDayLight() {
    world.chunkManager = new LightWorkerChunkManager();
    world.light = new LightQueue({offset: 0});
    world.dayLight = new LightQueue({offset: OFFSET_DAY});
    world.dayLightSrc = new DirLightQueue({offset: OFFSET_DAY});

    let innerDataEmpty = new Uint8Array([0]);
    let innerDataSolid = new Uint8Array([MASK_SRC_BLOCK + MASK_SRC_AO]);
    let w = 1;

    let centerChunk = [];

    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            for (let z = 0; z < 3; z++) {
                const light_buffer = (y < 2) ? innerDataEmpty.buffer : innerDataSolid.buffer;
                let chunk = new Chunk({addr: new Vector(x, y, z), size: new Vector(w, w, w), light_buffer});
                chunk.init();
                world.chunkManager.add(chunk);
                chunk.fillOuter();

                if (x === 1 && z === 1 && y <= 1) {
                    centerChunk.push(chunk);
                }
            }
        }
    }

    world.dayLightSrc.doIter(10000);
    world.dayLight.doIter(10000);

    for (let cc of centerChunk) {
        let {uint8View, outerLen, strideBytes} = cc.lightChunk;
        for (let coord = 0; coord < outerLen; coord++) {
            if (uint8View[coord * strideBytes + OFFSET_DAY + OFFSET_LIGHT] > 0) {
                return false;
            }
            if (uint8View[coord * strideBytes + OFFSET_DAY + OFFSET_SOURCE] > 0) {
                return false;
            }
        }
    }
    return true;
}

function testDisperse() {
    world.chunkManager = new LightWorkerChunkManager();
    world.light = new LightQueue({offset: 0});
    world.dayLight = new LightQueue({offset: OFFSET_DAY});
    world.dayLightSrc = new DirLightQueue({offset: OFFSET_DAY, disperse: Math.ceil(maxLight / 2)});

    let innerDataEmpty = new Uint8Array([0]);
    let innerDataSolid = new Uint8Array([MASK_SRC_BLOCK + MASK_SRC_AO]);
    let w = 1;

    let centerChunk = [];

    const maxY = 3;
    for (let y = 0; y < maxY; y++) {
        for (let x = 0; x < 3; x++) {
            for (let z = 0; z < 3; z++) {
                const light_buffer = (y < maxY - 1) ? innerDataEmpty.buffer : innerDataSolid.buffer;
                let chunk = new Chunk({addr: new Vector(x, y, z), size: new Vector(w, w, w), light_buffer});
                chunk.init();
                world.chunkManager.add(chunk);
                chunk.fillOuter();

                if (x === 1 && z === 1 && y < maxY - 1) {
                    centerChunk.push(chunk);
                }
                // if (y < maxY - 1) {
                //     centerChunk.push(chunk);
                // }
                world.dayLightSrc.doIter(100);
                world.dayLight.doIter(2000);
            }
        }
    }
    // world.dayLight.doIter(10000);
    for (let cc of centerChunk) {
        let {uint8View, outerLen, strideBytes} = cc.lightChunk;
        for (let coord = 0; coord < outerLen; coord++) {
            if (uint8View[coord * strideBytes + OFFSET_DAY + OFFSET_LIGHT] > 0) {
                return false;
            }
            if (uint8View[coord * strideBytes + OFFSET_DAY + OFFSET_SOURCE] > 0) {
                return false;
            }
        }
    }
    return true;
}
