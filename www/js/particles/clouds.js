import {Vector} from '../helpers.js';
import { default as push_cube_style } from '../block_style/cube.js';
import GeometryTerrain from "../geometry_terrain.js";
import {Resources} from "../resources.js";
import {BLOCK} from "../blocks.js";

const {mat4} = glMatrix;

const push_cube = push_cube_style.getRegInfo().func;

class TBlock {

    constructor(id) {this.id = id;}

    get material() {
        return BLOCK.BLOCK_BY_ID.get(this.id);
    }

    hasTag(tag) {
        let mat = this.material;
        return mat.tags && mat.tags.indexOf(tag) >= 0;
    }

    getCardinalDirection() {
        return Vector.ZERO;
    }

}

// World
const FakeCloudWorld = {
    blocks_pushed: 0,
    clouds: {
        imgData: null,
        size: new Vector(256, 1, 256),
        blocks: Array(256).fill(null).map(el => Array(256).fill(null)),
        init: function() {
            let index = 0;
            for(let x = 0; x < this.size.x; x++) {
                for(let z = 0; z < this.size.z; z++) {
                    let is_cloud = this.imgData.data[index + 3] > 10;
                    if(is_cloud) {
                        this.blocks[x][z] = new TBlock(BLOCK.CLOUD.id);
                    }
                    index += 4;
                }
            }
        }
    },
    chunkManager: {
        getBlock: function(x, y, z) {
            if(y == 0) {
                let clouds = FakeCloudWorld.clouds;
                if(x >= 0 && x < clouds.size.x) {
                    if(z >= 0 && z < clouds.size.z) {
                        let resp = clouds.blocks[x][z]
                        if(resp) {
                            return resp;
                        }
                    }
                }
            }
            return new TBlock(BLOCK.AIR.id);
        }
    }
}

export default class Particles_Clouds {

    // Constructor
    constructor(gl, pos) {
        FakeCloudWorld.clouds.imgData = Resources.clouds.texture;
        BLOCK.clearBlockCache();
        this.scale      = new Vector(8, 4, 8);
        this.pn         = performance.now();
        this.yaw        = -Math.PI;
        this.life       = 0.5;
        this.loading    = false;
        this.pos        = new Vector(pos.x, pos.y, pos.z);
        this.vertices   = [];
        //
        FakeCloudWorld.clouds.init();
        //
        let cloud_movement = 128;
        this.pos.x += cloud_movement * this.scale.x;
        this.pos.z += cloud_movement * this.scale.z;
        //
        let neighbours  = {
            UP: null,
            DOWN: null,
            NORTH: null,
            SOUTH: null,
            WEST: null,
            EAST: null
        };
        //
        let clouds = FakeCloudWorld.clouds;
        let y = 0;
        for(let x = 0; x < clouds.size.x; x++) {
            for(let z = 0; z < clouds.size.z; z++) {
                // @todo Временно, чтобы сильно не напрягать проц
                if(x < 64 || z < 64 || x > 196 || z > 196) {
                    continue;
                }
                let block  = FakeCloudWorld.chunkManager.getBlock(x, 0, z);
                if(block.id > 0) {
                    neighbours.NORTH = FakeCloudWorld.chunkManager.getBlock(x, 0, z + 1);
                    neighbours.SOUTH = FakeCloudWorld.chunkManager.getBlock(x, 0, z - 1);
                    neighbours.WEST = FakeCloudWorld.chunkManager.getBlock(x - 1, 0, z);
                    neighbours.EAST = FakeCloudWorld.chunkManager.getBlock(x + 1, 0, z);
                    push_cube(block, this.vertices, FakeCloudWorld, x, y, z, neighbours, null, false);
                }
            }
        }
        this.modelMatrix = mat4.create();
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, this.yaw);
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.swapYZ().toArray());
        //
        // console.log(parseInt(this.vertices.length / 21) + ' quads in clouds ');
        //
        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
    }

    // Draw
    draw(render, delta) {
        delta /= 1000;
        // движение на восток
        let wind_move = delta * .01;
        this.pos.x -= wind_move;
        render.renderBackend.drawMesh(this.buffer, render.defaultShader.materials.transparent, this.pos, this.modelMatrix);
    }

    destroy(render) {
        this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
