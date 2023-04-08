import type {Vector} from "../helpers/vector.js";

export class ChunkGridMath {
    cx = 0;
    cy = 0;
    cz = 0;
    cw = 0;
    CHUNK_SIZE = 0;
    CHUNK_SIZE_OUTER = 0;

    constructor(){

    }

    getFlatIndexInChunk(vec: Vector): int {
        return 0;
    }

    relativePosToFlatIndexInChunk(vec: Vector): int {
        return 0;
    }

    fromFlatChunkIndex(vec: Vector, index : int) {
        return vec;
    }

    isRelativePosInChunk(vec: Vector) {
        return true;
    }

    isRelativePosInChunk_s(x: number, y: number, z: number) {
        return true;
    }

    worldPosToChunkIndex(vec: Vector): int {
        return 0;
    }

    relativePosToChunkIndex_s(x: int, y: int, z: int): int {
        return 0;
    }

    relativePosToFlatIndexInChunk_s(x: int, y: int, z: int): int {
        return 0;
    }

    relativePosToChunkIndex(vec: Vector): int {
        return 0;
    }

    yFromChunkIndex(index: number) {
        return 0;
    }

    fromChunkIndex(vec: Vector, index: number): Vector {
        return vec;
    }

    getBlockIndex(x : int, y : int, z : int, vec : Vector) : Vector {
        return vec
    }

}

export function generateChunkGridMath(chunkSize): ChunkGridMath {
    const CHUNK_SIZE_X = chunkSize.x;
    const CHUNK_SIZE_Y = chunkSize.y;
    const CHUNK_SIZE_Z = chunkSize.z;
    const CHUNK_SIZE = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
    const CHUNK_PADDING = 1;
    const CHUNK_OUTER_SIZE_X = CHUNK_SIZE_X + 2 * CHUNK_PADDING;
    const CHUNK_OUTER_SIZE_Y = CHUNK_SIZE_Y + 2 * CHUNK_PADDING;
    const CHUNK_OUTER_SIZE_Z = CHUNK_SIZE_Z + 2 * CHUNK_PADDING;
    const CHUNK_CX = 1;
    const CHUNK_CY = CHUNK_OUTER_SIZE_X * CHUNK_OUTER_SIZE_Z;
    const CHUNK_CZ = CHUNK_OUTER_SIZE_X;
    const CHUNK_SIZE_OUTER = CHUNK_CY * CHUNK_OUTER_SIZE_Y;
    /* It's faster for generating chunks, but currently breaks meshing
    const CHUNK_CY = 1;
    const CHUNK_CZ = CHUNK_OUTER_SIZE_Y;
    const CHUNK_CX = CHUNK_OUTER_SIZE_Y * CHUNK_OUTER_SIZE_Z;
    */
    const CHUNK_CW = CHUNK_PADDING * (CHUNK_CX + CHUNK_CY + CHUNK_CZ);


    const advancedFunctions = `

    // функция евклидового модуля
    // res = (n, m) => ((n % m) + m) % m
    getBlockIndex(x, y, z, vec) {
        vec.x = ((x % ${CHUNK_SIZE_X}) + ${CHUNK_SIZE_X}) % ${CHUNK_SIZE_X}
        vec.y = ((y % ${CHUNK_SIZE_Y}) + ${CHUNK_SIZE_Y}) % ${CHUNK_SIZE_Y}
        vec.z = ((z % ${CHUNK_SIZE_Z}) + ${CHUNK_SIZE_Z}) % ${CHUNK_SIZE_Z}
        return vec
    }

    // Return flat index of chunk block
    getFlatIndexInChunk(vec) {
        let x = vec.x - Math.floor(vec.x / ${CHUNK_SIZE_X}) * ${CHUNK_SIZE_X};
        let y = vec.y - Math.floor(vec.y / ${CHUNK_SIZE_Y}) * ${CHUNK_SIZE_Y};
        let z = vec.z - Math.floor(vec.z / ${CHUNK_SIZE_Z}) * ${CHUNK_SIZE_Z};
        return (${CHUNK_SIZE_X} * ${CHUNK_SIZE_Z}) * y + (z * ${CHUNK_SIZE_X}) + x;
    }

    relativePosToFlatIndexInChunk(vec) {
        return ${CHUNK_SIZE_X} * (${CHUNK_SIZE_Z} * vec.y + vec.z) + vec.x;
    }

    //
    fromFlatChunkIndex(vec, index)  {
        vec.x = index % ${CHUNK_SIZE_X};
        vec.y = index / (${CHUNK_SIZE_X} * ${CHUNK_SIZE_Z}) | 0;
        vec.z = (index % (${CHUNK_SIZE_X} * ${CHUNK_SIZE_Z}) - vec.x) / ${CHUNK_SIZE_X};
        return vec;
    }

    /** Returns true if a point relative to a chunk is inside the chunk (not in its padding). */
    isRelativePosInChunk(vec) {
        return (vec.x | vec.y | vec.z) >= 0 &&
            vec.x < ${CHUNK_SIZE_X} && vec.y < ${CHUNK_SIZE_Y} && vec.z < ${CHUNK_SIZE_Z}
    }
    
    isRelativePosInChunk_s(x, y, z) {
        return (x | y | z) >= 0 &&
            x < ${CHUNK_SIZE_X} && y < ${CHUNK_SIZE_Y} && z < ${CHUNK_SIZE_Z}
    }

    worldPosToChunkIndex(vec) {
        const x = vec.x - Math.floor(vec.x / ${CHUNK_SIZE_X}) * ${CHUNK_SIZE_X};
        const y = vec.y - Math.floor(vec.y / ${CHUNK_SIZE_Y}) * ${CHUNK_SIZE_Y};
        const z = vec.z - Math.floor(vec.z / ${CHUNK_SIZE_Z}) * ${CHUNK_SIZE_Z};
        return ${CHUNK_CX} * x + ${CHUNK_CY} * y + ${CHUNK_CZ} * z + ${CHUNK_CW};
    }

    relativePosToChunkIndex_s(x, y, z) {
        return ${CHUNK_CX} * x + ${CHUNK_CY} * y + ${CHUNK_CZ} * z + ${CHUNK_CW};
    }

    relativePosToFlatIndexInChunk_s(x, y, z) {
        return ${CHUNK_SIZE_X} * (${CHUNK_SIZE_Z} * y + z) + x;
    }

    relativePosToChunkIndex(vec) {
        return ${CHUNK_CX} * vec.x + ${CHUNK_CY} * vec.y + ${CHUNK_CZ} * vec.z + ${CHUNK_CW};
    }
    `;

    let moreFunctions = '';
    if (CHUNK_CX === 1) {
        /*
        CHUNK_CY = CHUNK_OUTER_SIZE_X * CHUNK_OUTER_SIZE_Z
        CHUNK_CZ = CHUNK_OUTER_SIZE_X
        */
        moreFunctions = `
    fromChunkIndex(vec, index) {
        vec.x = index % ${CHUNK_OUTER_SIZE_X} - ${CHUNK_PADDING};
        index  = index / ${CHUNK_OUTER_SIZE_X} | 0;
        vec.z = index % ${CHUNK_OUTER_SIZE_Z} - ${CHUNK_PADDING};
        vec.y = (index / ${CHUNK_OUTER_SIZE_Z} | 0) - ${CHUNK_PADDING};
        return vec;
    }

    yFromChunkIndex(index) {
        return (index / (${CHUNK_OUTER_SIZE_X} * ${CHUNK_OUTER_SIZE_Z}) | 0) - ${CHUNK_PADDING}
    }
`;
    } else if (CHUNK_CY === 1) {
        /*
        CHUNK_CZ = CHUNK_OUTER_SIZE_Y
        CHUNK_CX = CHUNK_OUTER_SIZE_Y * CHUNK_OUTER_SIZE_Z
        */
        moreFunctions = `
    fromChunkIndex(vec, index) {
        index = index | 0
        const dividedByY = index / ${CHUNK_OUTER_SIZE_Y} | 0
        vec.y = index - (dividedByY * ${CHUNK_OUTER_SIZE_Y}) - ${CHUNK_PADDING}
        const dividedYZ = dividedByY / ${CHUNK_OUTER_SIZE_Z} | 0
        vec.z = dividedByY - (dividedYZ * ${CHUNK_OUTER_SIZE_Z}) - ${CHUNK_PADDING}
        vec.x = dividedYZ - ${CHUNK_PADDING}
        return vec
    }

    yFromChunkIndex(index) {
        return (index % ${CHUNK_OUTER_SIZE_Y}) - ${CHUNK_PADDING}
    }
`;
    }

    const source = `
return class extends ChunkGridMath {
${advancedFunctions}
${moreFunctions}
}`;

    const clazz = new Function('ChunkGridMath', source)(ChunkGridMath);
    const inst = new clazz();

    inst.cx = CHUNK_CX;
    inst.cy = CHUNK_CY;
    inst.cz = CHUNK_CZ;
    inst.cw = CHUNK_CW
    inst.CHUNK_SIZE = CHUNK_SIZE;
    inst.CHUNK_SIZE_OUTER = CHUNK_SIZE_OUTER;

    return inst;
}

let map = new Map<string, ChunkGridMath>();
export function getCachedChunkGridMath(chunkSize: Vector) {
    const key = chunkSize.toString();
    let res = map.get(key);
    if (!res) {
        res = generateChunkGridMath(chunkSize);
        map.set(key, res);
    }
    return res;
}
