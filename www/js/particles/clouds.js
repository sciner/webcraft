import {Color, DIRECTION, NORMALS, QUAD_FLAGS, TX_CNT, Vector} from '../helpers.js';
import {BLOCK} from '../blocks.js';
import {push_cube} from '../block_style/cube.js';
import GeometryTerrain from "../geometry_terrain.js";
import {Resources} from "../resources.js";

const {mat4} = glMatrix;

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
const world = {
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
                        this.blocks[x][z] = BLOCK.CLOUD;
                    }
                    index += 4;
                }
            }
        }
    },
    chunkManager: {
        getBlock: function(x, y, z) {
            if(y == 0) {
                let clouds = world.clouds;
                if(x >= 0 && x < clouds.size.x) {
                    if(z >= 0 && z < clouds.size.z) {
                        let resp = clouds.blocks[x][z]
                        if(resp) {
                            return resp;
                        }
                    }
                }
            }
            return BLOCK.AIR;
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
        world.clouds.init(imgData.data);
    });

export default class Particles_Clouds {

    // Constructor
    constructor(gl, pos) {
        BLOCK.clearBlockCache();
        this.scale      = new Vector(8, 4, 8);
        this.pn         = performance.now();
        this.yaw        = -Math.PI; // -Game.world.localPlayer.angles[2];
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
        let clouds = world.clouds;
        let y = 0;
        for(let x = 0; x < clouds.size.x; x++) {
            for(let z = 0; z < clouds.size.z; z++) {
                // @todo Временно, чтобы сильно не напрягать проц
                if(x < 64 || z < 64 || x > 196 || z > 196) {
                    continue;
                }
                let block  = world.chunkManager.getBlock(x, 0, z);
                if(block.id > 0) {
                    neighbours.NORTH = world.chunkManager.getBlock(x, 0, z + 1);
                    neighbours.SOUTH = world.chunkManager.getBlock(x, 0, z - 1);
                    neighbours.WEST = world.chunkManager.getBlock(x - 1, 0, z);
                    neighbours.EAST = world.chunkManager.getBlock(x + 1, 0, z);
                    push_cube(block, this.vertices, world, null, x, y, z, neighbours, null, false);
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