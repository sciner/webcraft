class Mesh_Pigeon {

    // Constructor
    constructor(gl, pos) {
        this.pos = new Vector(
            pos.x,
            pos.y,
            pos.z
        );
        var that = this;
        // loadText('/vendors/uploads_files_2342633_pigeon.obj', function(text) {
        loadText('/vendors/Mickey Mouse.obj', function(text) {
            that.obj = parseOBJ(gl, text);
            //
            that.makeBuffers(gl);
            Game.world.meshes['Pigeon'] = that;
            console.log('this.obj', that);
        });
    }
    
    makeBuffers(gl) {
        this.buffers = [];
        for(var g of this.obj.geometries) {
            var position = g.data.position;
            var texcoord = g.data.texcoord;
            var normal = g.data.normal;
            var buffer = {
                vertices: [],
                info: gl.createBuffer()
            };
            buffer.vertices = new Float32Array(position.length / 3 * 12);
            buffer.info.vertices = buffer.vertices.length / 12;
            var idx = 0;
            var min_z = 0;
            for(var i = 0; i < position.length / 3; i++) {
                // copy vertices
                buffer.vertices[idx + 0] = position[i * 3 + 0] / 130;
                buffer.vertices[idx + 1] = position[i * 3 + 2] / 130;
                buffer.vertices[idx + 2] = position[i * 3 + 1] / 130;
                // allign by bottom point
                if(buffer.vertices[idx + 2] < min_z) {
                    min_z = buffer.vertices[idx + 2];
                }
                // copy normal
                buffer.vertices[idx + 9] = normal[i * 3 + 0];
                buffer.vertices[idx + 10] = normal[i * 3 + 1];
                buffer.vertices[idx + 11] = normal[i * 3 + 2];
                idx += 12;
            }
            if(min_z < 0) {
                for(var i = 0; i < buffer.vertices.length; i += 12) {
                    buffer.vertices[i + 2] -= min_z;
                }
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer.info);
            gl.bufferData(gl.ARRAY_BUFFER, buffer.vertices, gl.DYNAMIC_DRAW);
            this.buffers.push(buffer);
        }
    }

    // Draw
    draw(render, delta, modelMatrix, uModelMat) {
        var gl = render.gl;
        var program = render.program;
        
        //
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, [
            this.pos.x - Game.shift.x,
            this.pos.y - Game.shift.y,
            this.pos.z - Game.shift.z
        ]);
        // render
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
        gl.disable(gl.CULL_FACE);
        for(var buf of this.buffers) {
            render.drawBuffer(buf.info);
        }
        gl.enable(gl.CULL_FACE);
        // this.obj.base_render(gl, program);
    }

    destroy(render) {
    }

    isAlive() {
        return true;
    }

}