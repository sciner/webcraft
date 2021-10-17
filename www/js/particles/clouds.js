import {Vector} from '../helpers.js';
import {BLOCK} from '../blocks.js';
import { default as push_cube_style } from '../block_style/cube.js';
import GeometryTerrain from "../geometry_terrain.js";
import {Resources} from "../resources.js";
import { TBlock } from '../typed_blocks.js';

const {mat4} = glMatrix;

const push_cube = push_cube_style.getRegInfo().func;

/*loadTexture(render) {
let that = this;
Resources
    .loadImage('/media/clouds.png', false)
    .then(image1 => {
        const texture1 = render.renderBackend.createTexture({
            source: image1,
            minFilter: 'nearest',
            magFilter: 'nearest'
        });
        this.that.clouds_ = render.materials.transparent.getSubMat(texture1);
    });
}*/

// World
const FakeCloudWorld = {
    blocks_pushed: 0,
    clouds: {
        size: new Vector(256, 1, 256),
        blocks: Array(256).fill(null).map(el => Array(256).fill(null)),
        init: function(data) {
            let index = 0;
            for(let x = 0; x < this.size.x; x++) {
                for(let z = 0; z < this.size.z; z++) {
                    let is_cloud = data[index + 3] > 10;
                    if(is_cloud) {
                        this.blocks[x][z] = {
                            id:         BLOCK.CLOUD.id,
                            material:   BLOCK.CLOUD,
                            getCardinalDirection: () => new Vector(0, 0, 0)
                        };
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
            return {
                id:         BLOCK.AIR.id,
                material:   BLOCK.AIR,
                getCardinalDirection: () => new Vector(0, 0, 0)
            };
        }
    }
}

// Загрузка карты облаков
await Resources
    .loadImage('/media/clouds.png', false)
    .then(image1 => {
        let canvas          = document.createElement('canvas');
        canvas.width        = 256;
        canvas.height       = 256;
        let ctx             = canvas.getContext('2d');
        ctx.drawImage(image1, 0, 0, 256, 256, 0, 0, 256, 256);
        var imgData = ctx.getImageData(0, 0, 256, 256);
        FakeCloudWorld.clouds.init(imgData.data);
    });

export default class Particles_Clouds {

    // Constructor
    constructor(gl, pos) {
        BLOCK.clearBlockCache();
        this.scale      = new Vector(8, 4, 8);
        this.pn         = performance.now();
        this.yaw        = -Math.PI;
        this.life       = 0.5;
        this.loading    = false;
        this.pos        = new Vector(pos.x, pos.y, pos.z);
        this.vertices   = [];
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
                    push_cube(block, this.vertices, FakeCloudWorld, null, x, y, z, neighbours, null, false);
                }
            }
        }
        this.modelMatrix = mat4.create();
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, this.yaw);
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.swapYZ().toArray());
        //
        console.log(parseInt(this.vertices.length/21) + ' quads in clouds ');
        //
        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
    }

    // Draw
    draw(render, delta) {
        delta /= 1000;
        // движение на восток
        let wind_move = delta * .01;
        this.pos.x -= wind_move;
        render.renderBackend.drawMesh(this.buffer, render.materials.transparent, this.pos, this.modelMatrix);
    }

    destroy(render) {
        this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}