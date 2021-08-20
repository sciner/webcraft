import {Color, Vector} from "./helpers.js";
import {BLOCK, CHUNK_SIZE_Y_MAX} from "./blocks.js";
import { BaseTerrainShader } from "./renders/BaseRenderer.js";
import GeometryTerrain from "./geometry_terrain.js";

const {mat4} = glMatrix;

const PICKAT_DIST = 5;

export default class PickAt {

    constructor(render) {
        this.render = render;
        this.target_block = false;
        this.target_buffer = null;
    }

    //
    get(callback) {
        const player = Game.world.localPlayer;
        const render = this.render;
        const pos = new Vector(player.pos);
        const m = mat4.invert(mat4.create(), render.viewMatrix);
        pos.y = m[14];
        const startBlock = new Vector(Math.floor(pos.x) + 0.5, Math.floor(pos.y) + 0.5, Math.floor(pos.z) + 0.5);
        let dir = new Vector(-m[8], -m[10], -m[9]);
        if(dir.length() < 0.01) {
            if(callback) {
                callback(false);
            }
            return false;
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
                if(dir[d] > eps && tMin > (block[d] + 0.5 - pos[d]) / dir[d]) {
                    tMin = (block[d] + 0.5 - pos[d]) / dir[d];
                    side.zero()[d] = 1;
                }
                if(dir[d] < -eps && tMin > (block[d] - 0.5 - pos[d]) / dir[d]) {
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
            const ix = block.x | 0, iy = block.y | 0, iz = block.z | 0;
            let b = Game.world.chunkManager.getBlock(ix, iy, iz);
            if(b.id !== BLOCK.AIR.id && b.id !== BLOCK.STILL_WATER.id) {
                side.x = -side.x;
                side.y = -side.y;
                side.z = -side.z;
                res = {
                    x: ix, y: iy, z: iz, n: side
                };
                break;
            }
        }
        if(callback) {
            callback(res);
        }
        return res;
    }

    /**
     * drawTarget...
     * @returns bool
     */
    drawTarget(render, shift) {
        let b = this.get();
        if(b) {
            if(!this.target_block ||
                (this.target_block.x != b.x || this.target_block.y != b.y || this.target_block.z != b.z ||
                    this.target_block.n.x != b.n.x || this.target_block.n.y != b.n.y || this.target_block.n.z != b.n.z)) {
                // @todo need update target block
                this.target_block = b;
                let vertices    = [];
                let ao          = [0, 0, 0, 0];
                let c           = BLOCK.calcTexture([0, 17]);
                let lm          = new Color(0, 0, 0);
                let flags       = 0, sideFlags = 0, upFlags = 0;
                let bH          = 1;
                let width       = 1;
                let height      = 1;
                let x           = b.x - shift.x;
                let y           = b.y - shift.y;
                let z           = b.z - shift.z;
                // Up;
                vertices.push(x + 0.5, z + 0.5, y + bH - 1 + height,
                    1, 0, 0,
                    0, 1, 0,
                    c[0], c[1], c[2], c[3],
                    lm.r, lm.g, lm.b,
                    ao[0], ao[1], ao[2], ao[3], flags | upFlags);
                // Bottom
                vertices.push(x + 0.5, z + 0.5, y,
                    1, 0, 0,
                    0, -1, 0,
                    c[0], c[1], c[2], c[3],
                    lm.r, lm.g, lm.b,
                    ao[0], ao[1], ao[2], ao[3], flags);
                // Forward
                vertices.push(x + .5, z + .5 - width / 2, y + bH / 2,
                    1, 0, 0,
                    0, 0, bH,
                    c[0], c[1], c[2], -c[3],
                    lm.r, lm.g, lm.b,
                    ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
                // Back
                vertices.push(x + .5, z + .5 + width / 2, y + bH / 2,
                    1, 0, 0,
                    0, 0, -bH,
                    c[0], c[1], -c[2], c[3],
                    lm.r, lm.g, lm.b,
                    ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
                // Left
                vertices.push(x + .5 - width / 2, z + .5, y + bH / 2,
                    0, 1, 0,
                    0, 0, -bH,
                    c[0], c[1], -c[2], c[3],
                    lm.r, lm.g, lm.b,
                    ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
                // Right
                vertices.push(x + .5 + width / 2, z + .5, y + bH / 2,
                    0, 1, 0,
                    0, 0, bH,
                    c[0], c[1], c[2], -c[3],
                    lm.r, lm.g, lm.b,
                    ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
                // Delete old buffer
                if(this.target_buffer) {
                    this.target_buffer.destroy();
                }
                // Create buffer
                this.target_buffer = new GeometryTerrain(vertices);
            }
        } else {
            return this.target_block = false;
        }
        // draw
        const mat = render.materials['regular'];
        render.renderBackend.drawMesh(this.target_buffer, mat);
        // return true
        return true;
    }

}