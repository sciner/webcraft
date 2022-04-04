import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE} from "../chunk.js";
import {Color, Vector, VectorCollector} from "../helpers.js";

const CLUSTER_PADDING   = 4;
const CLUSTER_SIZE      = new Vector(64, 128, 64);
const temp_vec2         = new Vector(0, 0, 0);

// ChunkCluster
export class ChunkCluster {

    // All clusters
    static all = new VectorCollector();

    // Return cluster
    static get(coord) {
        const addr = new Vector(coord.x, coord.y, coord.z).divScalarVec(CLUSTER_SIZE).flooredSelf();
        if(ChunkCluster.all.has(addr)) {
            return ChunkCluster.all.get(addr);
        }
        const cluster = new ChunkCluster(addr);
        ChunkCluster.all.set(addr, cluster);
        return cluster;
    }

    // constructor
    constructor(addr) {
        this.addr = addr;
        this.coord = addr.multiplyVecSelf(CLUSTER_SIZE);
        this.is_empty = this.addr.y != 0;
        this.mask = new Array(CLUSTER_SIZE.x * CLUSTER_SIZE.z);
        if(this.is_empty) {
            return;
        }
        for(let x = CLUSTER_PADDING; x < CLUSTER_SIZE.x - CLUSTER_PADDING; x++) {
            for(let z = CLUSTER_PADDING; z < CLUSTER_SIZE.z - CLUSTER_PADDING; z++) {
                if(x < CLUSTER_PADDING + 2 || z < CLUSTER_PADDING + 2 || x >= CLUSTER_SIZE.x - CLUSTER_PADDING - 2 || z >= CLUSTER_SIZE.z - CLUSTER_PADDING - 2) {
                    this.mask[z * CLUSTER_SIZE.x + x] = new Color(8, 0, 1);
                }
            }
        }
    }

    // Generate chunk blocks
    generateBlocks(chunk, map) {
        if(this.is_empty) {
            return false;
        }
        //
        const setBlock = (x, y, z, block_id, rotate) => {
            // temp_vec2.set(x, y, z);
            temp_vec2.x = x;
            temp_vec2.y = y;
            temp_vec2.z = z;
            const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * temp_vec2.y + (temp_vec2.z * CHUNK_SIZE_X) + temp_vec2.x;
            if(rotate) {
                chunk.tblocks.rotate.set(temp_vec2, rotate);
            }
            chunk.tblocks.id[index] = block_id;
        };
        //
        const getBlock = (x, y, z) => {
            const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
            return chunk.tblocks.id[index];
        };
        //
        const start_x = chunk.coord.x - this.coord.x;
        const start_z = chunk.coord.z - this.coord.z;
        const CHUNK_Y_BOTTOM = chunk.coord.y;
        for(let i = 0; i < CHUNK_SIZE_X; i++) {
            for(let j = 0; j < CHUNK_SIZE_Z; j++) {
                let x = start_x + i;
                let z = start_z + j;
                let info = this.mask[z * CLUSTER_SIZE.x + x];
                if(info && info.r) {
                    const cell = map.info.cells[i][j];
                    for(let k = 0; k < info.r; k++) {
                        let y = cell.value2 + k - CHUNK_Y_BOTTOM - 1;
                        let block_id = getBlock(i, y, j);
                        if(block_id && (block_id == cell.biome.dirt_block)) {
                            setBlock(i, y, j, 468, null);
                        }
                    }
                }
            }
        }
    }

    //
    cellIsOccupied(x, y, z, margin) {
        x -= this.coord.x;
        y -= this.coord.y;
        z -= this.coord.z;
        for(let i = -margin; i <= margin; i++) {
            for(let j = -margin; j <= margin; j++) {
                const dx = x + i;
                const dz = z + j;
                if(dx >= 0 && dz >= 0 && dx < CLUSTER_SIZE.x && z < CLUSTER_SIZE.z) {
                    const info = this.mask[dz * CLUSTER_SIZE.x + dx];
                    if(info && info.r) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

}