const {mat4} = glMatrix;

class Mesh_Default {

    // Constructor
    constructor(gl, pos, file, callback) {
        this.pos = new Vector(
            pos.x,
            pos.y,
            pos.z
        );
        let that = this;
        loadText(file, function(text) {
            that.obj = parseOBJ(gl, text);
            that.makeBuffers(gl);
            callback(that);
        });
    }

    makeBuffers(gl) {
        this.buffers = [];
        const VERTICES_POINTS = 12;
        for(let g of this.obj.geometries) {
            let position = g.data.position;
            let normal = g.data.normal;
            let vertices = new Float32Array(position.length / 3 * VERTICES_POINTS);

            let buffer = {
                vertices,
                info: new GeometryTerrain(GeometryTerrain.convertFrom12(vertices))
            };
            let idx = 0;
            let min_z = 0;
            for(let i = 0; i < position.length / 3; i++) {
                // copy vertices
                buffer.vertices[idx + 0] = position[i * 3 + 0] / 1;
                buffer.vertices[idx + 1] = position[i * 3 + 1] / 1;
                buffer.vertices[idx + 2] = position[i * 3 + 2] / 1;
                // allign by bottom point
                if(buffer.vertices[idx + 2] < min_z) {
                    min_z = buffer.vertices[idx + 2];
                }
                // copy normal
                buffer.vertices[idx + 9] = normal[i * 3 + 0];
                buffer.vertices[idx + 10] = normal[i * 3 + 1];
                buffer.vertices[idx + 11] = normal[i * 3 + 2];
                idx += VERTICES_POINTS;
            }
            if(min_z < 0) {
                for(let i = 0; i < buffer.vertices.length; i += VERTICES_POINTS) {
                    buffer.vertices[i + 2] -= min_z;
                }
            }
            this.buffers.push(buffer);
        }
    }

    // Draw
    draw(render, delta, modelMatrix, uModelMat) {
        let gl = render.gl;
        let a_pos = new Vector(this.pos.x - Game.shift.x, this.pos.z - Game.shift.z, this.pos.y - Game.shift.y);
        //
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, modelMatrix, [a_pos.x, a_pos.y, a_pos.z]);
        // render
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
        gl.disable(gl.CULL_FACE);
        for(let buf of this.buffers) {
            render.drawBuffer(buf.info, a_pos);
        }
        gl.enable(gl.CULL_FACE);
    }

    destroy(render) {
    }

    isAlive() {
        return true;
    }

}
