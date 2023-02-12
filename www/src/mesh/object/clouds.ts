import {QUAD_FLAGS, Vector} from '../../helpers.js';
import { default as push_cube_style } from '../../block_style/cube.js';
import GeometryTerrain from "../../geometry_terrain.js";
import {Resources} from "../../resources.js";
import {BLOCK, FakeTBlock} from "../../blocks.js";
import { AABB } from '../../core/AABB.js';
import { DEFAULT_CLOUD_HEIGHT } from '../../constant.js';

const {mat4} = glMatrix;

const push_cube = push_cube_style.func;

const CLOUDS_TEX_SIZE = 64;
const CLOUDS_TEX_SCALE = new Vector(16, 4, 16);
const WIND_SPEED_MUL = 1;

// World
const FakeCloudWorld = {
    blocks_pushed: 0,
    clouds: {
        imgData: null,
        blocks: [],
        init: function(aabb) {
            this.blocks = new Array(aabb.x_max * aabb.z_max).fill(null);
            for(let x = 0; x < aabb.x_max; x++) {
                for(let z = 0; z < aabb.z_max; z++) {
                    const index = (z * this.imgData.width + x);
                    const is_cloud = this.imgData.data[index * 4 + 3] > 10;
                    if(is_cloud) {
                        this.blocks[index] = new FakeTBlock(BLOCK.CLOUD.id);
                    }
                }
            }
        }
    },
    chunkManager: {
        getBlock: function(x, y, z) {
            const clouds = FakeCloudWorld.clouds;
            const index = (z * clouds.imgData.width + x);
            return clouds.blocks[index] || null;
        }
    }
}

export default class Mesh_Object_Clouds {

    // Constructor
    constructor(gl, height) {
        //
        const aabb = new AABB();
        aabb.set(0, 0, 0, CLOUDS_TEX_SIZE, 0, CLOUDS_TEX_SIZE);
        //
        this.pn         = performance.now();
        this.yaw        = -Math.PI;
        this.life       = 0.5;
        this.loading    = false;
        this.y_pos      = DEFAULT_CLOUD_HEIGHT;
        this.pos        = new Vector(0, height, 0);
        this.vertices   = [];
        //
        FakeCloudWorld.clouds.imgData = Resources.clouds.texture;
        FakeCloudWorld.clouds.init(aabb);
        //
        const neighbours  = {
            UP: null,
            DOWN: null,
            NORTH: null,
            SOUTH: null,
            WEST: null,
            EAST: null
        };
        const neighbours2  = {
            UP: null,
            DOWN: null,
            NORTH: null,
            SOUTH: null,
            WEST: null,
            EAST: null
        };
        const clouds_3d = false;
        const y = 0;
        for(let x = 0; x < aabb.x_max; x++) {
            for(let z = 0; z < aabb.z_max; z++) {
                const block  = FakeCloudWorld.chunkManager.getBlock(x, 0, z);
                if(block && block.id > 0) {
                    neighbours.NORTH = FakeCloudWorld.chunkManager.getBlock(x, 0, z + 1);
                    neighbours.SOUTH = FakeCloudWorld.chunkManager.getBlock(x, 0, z - 1);
                    neighbours.WEST = FakeCloudWorld.chunkManager.getBlock(x - 1, 0, z);
                    neighbours.EAST = FakeCloudWorld.chunkManager.getBlock(x + 1, 0, z);
                    const with_neightbours = neighbours.NORTH && neighbours.SOUTH && neighbours.WEST && neighbours.EAST;
                    // if(clouds_3d && with_neightbours) {
                    //     neighbours.UP = neighbours.DOWN = block;
                    // }
                    push_cube(block, this.vertices, FakeCloudWorld, x, y, z, neighbours, null, false);
                    if(clouds_3d && with_neightbours) {
                        neighbours2.UP = null;
                        neighbours2.DOWN = block;
                        push_cube(block, this.vertices, FakeCloudWorld, x, y + 1, z, neighbours2, null, false);
                        neighbours2.UP = neighbours2.DOWN;
                        neighbours2.DOWN = null;
                        push_cube(block, this.vertices, FakeCloudWorld, x, y - 1, z, neighbours2, null, false);
                    }
                }
            }
        }
        this.modelMatrix = mat4.create();
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, this.yaw);
        mat4.scale(this.modelMatrix, this.modelMatrix, CLOUDS_TEX_SCALE.swapYZ().toArray());
        //
        // console.log(parseInt(this.vertices.length / GeometryTerrain.strideFloats) + ' quads in clouds ');
        //
        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));
        this.buffer.changeFlags(QUAD_FLAGS.NO_FOG | QUAD_FLAGS.NO_AO, 'replace');
        this.buffer.updateInternal();
    }

    // Draw
    draw(render, delta) {
        const cam_pos = Qubatch.render.camPos.clone();

        cam_pos.y = cam_pos.y > 512 ? 1024.1 : this.y_pos; // this.pos.y

        const size = CLOUDS_TEX_SIZE * CLOUDS_TEX_SCALE.x;

        // движение на восток
        const wind_move = ((performance.now() - this.pn) / 1000 * WIND_SPEED_MUL) % size;

        const x = Math.floor(cam_pos.x / size) * size - wind_move;
        const z = Math.floor(cam_pos.z / size) * size;
        const material = render.defaultShader.materials.transparent;

        for(let mx = -2; mx <= 2; mx++) {
            for(let mz = -2; mz <= 2; mz++) {
                this.pos.set(x + mx * size + 1/2, cam_pos.y, z + mz * size + 1/2);
                render.renderBackend.drawMesh(this.buffer, material, this.pos, this.modelMatrix);        
            }
        }

    }

    destroy(render) {
        this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
