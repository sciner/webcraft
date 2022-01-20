import {Vector} from '../helpers.js';
import GeometryTerrain from "../geometry_terrain.js";
import {BLOCK} from "../blocks.js";
import {fillCube} from "../bedrockJsonParser.js";

const {mat4} = glMatrix;
const tmpMatrix = mat4.create();

export class Particles_Painting {

    // Constructor
    constructor(params) {

        this.size = [
            (params.aabb[3] - params.aabb[0]),
            (params.aabb[4] - params.aabb[1]),
            (params.aabb[5] - params.aabb[2])
        ]

        this.pos = new Vector(
            (params.aabb[0] + params.aabb[3]) / 2 - 1,
            (params.aabb[1] + params.aabb[4]) / 2 - 1,
            (params.aabb[2] + params.aabb[5]) / 2 - 1
        );

        this.modelMatrix    = mat4.create();
        this.lightTex       = null;
        this.life           = 1.0;
        this.vertices       = [];
        const textureSize   = [1 / 32, 1 / 32];

        fillCube({
            matrix: this.modelMatrix,
            size: this.size,
            textureSize: textureSize,
            uvPoint: [8.5 / 32, 10.5 / 32],
            mirror: false,
            inflate: 1
        }, this.vertices);

        this.block_material = BLOCK.DIRT;
        const resource_pack = this.block_material.resource_pack;
        
        this.material = resource_pack.getMaterial(this.block_material.material_key);

        this.buffer = new GeometryTerrain(new Float32Array(this.vertices));

    }

    updateLightTex(render) {
        /*const chunk = render.world.chunkManager.getChunk(this.chunk_addr);
        if (!chunk) {
            return;
        }
        this.chunk = chunk;
        this.lightTex = chunk.getLightTexture(render.renderBackend);
        */
    }

    // Draw
    draw(render, delta) {

        this.updateLightTex(render);

        mat4.identity(this.modelMatrix);
        /* mat4.translate(this.modelMatrix, this.modelMatrix, 
            [
                (this.posFact.x - this.chunk.coord.x),
                (this.posFact.z - this.chunk.coord.z),
                (this.posFact.y - this.chunk.coord.y + 3 / 16)
            ]
        );*/
        // mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.toArray());
        // mat4.rotateZ(this.modelMatrix, this.modelMatrix, this.addY / 60);
        // this.material.changeLighTex(this.lightTex);

        render.renderBackend.drawMesh(
            this.buffer,
            this.material,
            this.pos, // chunk.coord,
            this.modelMatrix
        );

        // this.material.lightTex = null;
        this.material.shader.unbind();

    }

    destroy() {
        this.buffer.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
