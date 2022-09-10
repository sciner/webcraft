import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import { Vector } from '../helpers.js';

const { mat3 } = glMatrix;

export class Mesh_Particle_Base {

    static current_count = 0;

    constructor() {
        this.pn = performance.now();
        this.lookAtMat = mat3.create();
        this.scale = new Vector(1, 1, 1);
    }

    // Draw
    draw(render, delta) {

        if(!this.chunk) {
            this.life = 0;
            return;
        }

        this.update(delta);

        this.buffer.updateInternal();
        const light = this.chunk.getLightTexture(render.renderBackend);
        this.material.changeLighTex(light);

        render.renderBackend.drawMesh(
            this.buffer,
            this.material,
            this.chunk.coord
        );

        this.material.lightTex = null;
    }

    destroy(render) {
        this.life = 0;
        if (this.buffer) {
            this.buffer.destroy();
            this.buffer = null;
        }
        this.vertices = null;
        this.particles = null;
    }

    isAlive() {
        return this.life > 0;
    }

}
