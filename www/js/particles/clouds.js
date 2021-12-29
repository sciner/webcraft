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
        return 0;
    }

}

// World
const FakeCloudWorld = {
    blocks_pushed: 0,
    clouds: {
        imgData: null,
        size: new Vector(256, 1, 256),
        blocks: Array(256).fill(null).map(el => Array(256).fill(null)),
        init: function(aabb) {
            let index = 0;
            for(let x = 0; x < this.size.x; x++) {
                for(let z = 0; z < this.size.z; z++) {
                    if(x >= aabb.min_x && x < aabb.max_x && z >= aabb.min_z && z < aabb.max_z) {
                        const is_cloud = this.imgData.data[index + 3] > 10;
                        if(is_cloud) {
                            this.blocks[x][z] = new TBlock(BLOCK.CLOUD.id);
                        }
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
                        //if(resp) {
                            return resp;
                        //}
                    }
                }
            }
            return null;
        }
    }
}

export default class Particles_Clouds {

    // Constructor
    constructor(gl, pos) {
        //
        const clouds = FakeCloudWorld.clouds;
        this.size = 64; // Временно, чтобы сильно не напрягать проц
        const aabb = {
            min_x: clouds.size.x / 2 - this.size / 2,
            max_x: clouds.size.x / 2 + this.size / 2,
            min_z: clouds.size.z / 2 - this.size / 2,
            max_z: clouds.size.z / 2 + this.size / 2
        };
        //
        FakeCloudWorld.clouds.imgData = Resources.clouds.texture;
        this.scale      = new Vector(16, 4, 16);
        this.pn         = performance.now();
        this.yaw        = -Math.PI;
        this.life       = 0.5;
        this.loading    = false;
        this.pos        = new Vector(pos.x, pos.y, pos.z);
        this.vertices   = [];
        //
        FakeCloudWorld.clouds.init(aabb);
        //
        const cloud_movement = 128;
        this.pos.x += cloud_movement * this.scale.x;
        this.pos.z += cloud_movement * this.scale.z;
        //
        this.posOrig = this.pos.clone();
        //
        const neighbours  = {
            UP: null,
            DOWN: null,
            NORTH: null,
            SOUTH: null,
            WEST: null,
            EAST: null
        };
        const y = 0;
        for(let x = aabb.min_x; x < aabb.max_x; x++) {
            for(let z = aabb.min_z; z < aabb.max_z; z++) {
                let block  = FakeCloudWorld.chunkManager.getBlock(x, 0, z);
                if(block && block.id > 0) {
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
        // console.log(parseInt(this.vertices.length / GeometryTerrain.strideFloats) + ' quads in clouds ');
        //
        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
    }

    // Draw
    draw(render, delta) {
        // движение на восток
        const wind_move = (performance.now() - this.pn) / 1000;
        this.pos.set(this.posOrig.x - wind_move, this.posOrig.y, this.posOrig.z);
        render.renderBackend.drawMesh(this.buffer, render.defaultShader.materials.transparent, this.pos, this.modelMatrix);
    }

    destroy(render) {
        this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
