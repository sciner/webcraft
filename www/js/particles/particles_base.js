import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import GeometryTerrain from "../geometry_terrain.js";
import { Vector } from '../helpers.js';

const { mat3, mat4, vec3 } = glMatrix;

export class Particles_Base {

    constructor() {
        this.pn = performance.now();
        this.lookAtMat = mat3.create();
        this.scale = new Vector(1, 1, 1);
    }

    // Draw
    draw(render, delta) {

        this.update(delta);

        if(!this.chunk) {
            this.life = 0;
            return;
        }

        const light    = this.chunk.getLightTexture(render.renderBackend);
        const data     = this.buffer.data;
        const vertices = this.vertices;
        const chCoord  = this.chunk.coord;
        const pos      = this.pos;

        // correction for light
        const corrX = pos.x - chCoord.x;
        const corrY = pos.y - chCoord.y;
        const corrZ = pos.z - chCoord.z;

        // really we should compute look at to each particle
        // but we can hack when looks to center of it

        const view = render.viewMatrix;
        mat3.fromMat4(this.lookAtMat, view);
        mat3.invert(this.lookAtMat, this.lookAtMat);
        mat4.scale(this.lookAtMat, this.lookAtMat, this.scale);

        //
        let idx = 0;
        let dataView;
        let startDataView;

        for (let j = 0; j < this.particles.length; j++) {
            const p = this.particles[j];

            for(let i = 0; i < p.vertices_count; i++) {
                dataView      = GeometryTerrain.decomposite(data, (idx + i) * GeometryTerrain.strideFloats, dataView);
                startDataView = GeometryTerrain.decomposite(vertices, (idx + i) * GeometryTerrain.strideFloats, startDataView);

                // pos
                // we can use vector notation
                // but again need flip axis
                dataView.position[0] = p.x + startDataView.position[0] + corrX;
                dataView.position[1] = p.z + startDataView.position[1] + corrZ;
                dataView.position[2] = p.y + startDataView.position[2] + corrY;

                // lol
                // neeed flip
                // because view matrix is normal
                // but array use XZY instead XYZ
                dataView.axisX[0] = startDataView.axisX[0];
                dataView.axisX[1] = startDataView.axisX[2];
                dataView.axisX[2] = startDataView.axisX[1];

                vec3.transformMat3(dataView.axisX, dataView.axisX, this.lookAtMat);

                dataView.axisY[0] = startDataView.axisY[0];
                dataView.axisY[1] = startDataView.axisY[2];
                dataView.axisY[2] = startDataView.axisY[1];

                vec3.transformMat3(dataView.axisY, dataView.axisY, this.lookAtMat);

            }

            idx += p.vertices_count;
        }

        this.buffer.updateInternal();
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
