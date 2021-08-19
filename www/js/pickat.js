import {Vector} from "./helpers.js";
import {BLOCK, CHUNK_SIZE_Y_MAX} from "./blocks.js";

const {mat4} = glMatrix;

const PICKAT_DIST = 5;

export default class PickAt {

    constructor(render) {
        this.render = render;
        this.callbacks = [];
    }

    get(callback) {
        this.callbacks.push(callback);
    }

    draw() {
        if(this.callbacks.length === 0) {
            return;
        }
        const player = Game.world.localPlayer;
        const render = this.render;
        const pos = new Vector(player.pos);
        const m = mat4.invert(mat4.create(), render.viewMatrix);

        pos.y = m[14];
        const startBlock = new Vector(Math.floor(pos.x) + 0.5, Math.floor(pos.y) + 0.5, Math.floor(pos.z) + 0.5);
        let dir = new Vector(-m[8], -m[10], -m[9]);
        if (dir.length() < 0.01) {
            this.callbacks.length = 0;
            return;
        }
        dir = dir.normal();
        let block = new Vector(startBlock);
        let res = false;
        let side = new Vector(0, 0, 0);
        const INF = 100000.0;
        const eps = 1e-3;
        const coord = ['x', 'y', 'z'];

        while (Math.abs(block.x - startBlock.x) < PICKAT_DIST
        && Math.abs(block.y - startBlock.y) < PICKAT_DIST
        && Math.abs(block.z - startBlock.z) < PICKAT_DIST) {
            let tMin = INF;
            for(let d of coord) {
                if (dir[d] > eps && tMin > (block[d] + 0.5 - pos[d]) / dir[d]) {
                    tMin = (block[d] + 0.5 - pos[d]) / dir[d];
                    side.zero()[d] = 1;
                }
                if (dir[d] < -eps && tMin > (block[d] - 0.5 - pos[d]) / dir[d]) {
                    tMin = (block[d] - 0.5 - pos[d]) / dir[d];
                    side.zero()[d] = -1;
                }
            }

            if (tMin >= INF) {
                break;
            }
            pos.x += dir.x * tMin;
            pos.y += dir.y * tMin;
            pos.z += dir.z * tMin;
            block = block.add(side);
            if (block.y > CHUNK_SIZE_Y_MAX || block.y < 0) {
                break;
            }

            const ix = block.x |0, iy = block.y|0, iz = block.z|0;
            let b = Game.world.chunkManager.getBlock(ix, iy, iz);
            if (b.id !== BLOCK.AIR.id && b.id !== BLOCK.STILL_WATER.id) {
                side.x = -side.x;
                side.y = -side.y;
                side.z = -side.z;
                res = {
                    x: ix, y: iy, z: iz, n: side
                };
                break;
            }
        }

        for (let i=0;i<this.callbacks.length;i++){
            this.callbacks[i](res);
        }
        this.callbacks.length = 0;
    }
}
