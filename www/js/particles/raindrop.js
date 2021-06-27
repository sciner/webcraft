class Particles_Raindrop {

    // Constructor
    constructor(gl, pos) {
        this.yaw        = -Game.world.localPlayer.angles[1];
        this.life       = 1;
        var lm          = new Color(0, 0, 0, 0);
        var n           = NORMALS.UP; // normal for lithning
        var width       = 1;
        var bH          = 1;
        this.texture    = BLOCK.STILL_WATER.texture;
        var c           = calcTexture(this.texture(this, null, 1, null, null, null, DIRECTION.FORWARD)); // полная текстура
        this.pos        = new Vector(pos.x, pos.y, pos.z);
        this.vertices   = [];
        this.particles  = [];
        //
        for(var i = 0; i < 100; i++) {
            const sz        = Math.random() * (2 / 16) + 1 / 16; // часть текстуры
            const half      = sz / TX_CNT;
            // случайная позиция в текстуре
            var cx = c[0] + Math.random() * (half * 3);
            var cy = c[1] + Math.random() * (half * 3);
            var c_half = [cx, cy, cx + half, cy + half];
            // случаная позиция частицы (в границах блока)
            var x = (Math.random() - Math.random()) * 16;
            var y = (Math.random() - Math.random()) * 16;
            var z = (Math.random() - Math.random()) * 16;
            push_plane(this.vertices, x, y, z, c_half, lm, n, true, false, sz / 3, null, sz);
            var p = {
                x:              x,
                y:              y,
                z:              z,
                vertices_count: 12,
                gravity:        -.40,
                speed:          .00375 * 3
            };
            var d = Math.sqrt(p.x * p.x + p.y * p.y);            
            p.x = p.x / d * p.speed;
            p.y = p.y / d * p.speed;
            this.particles.push(p);
        }
        //
        this.buffer = gl.createBuffer();
        this.vertices = new Float32Array(this.vertices);
        this.buffer.vertices = this.vertices.length / 12;
        //
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.DYNAMIC_DRAW);
    }

    // Draw
    draw(render, delta, modelMatrix, uModelMat) {
        var gl = render.gl;
        this.life -= delta / 100000;
        delta /= 1000;
        
        this.pos.z += delta * -.40;
        //
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, [
            this.pos.x - Game.shift.x,
            this.pos.y - Game.shift.y,
            this.pos.z - Game.shift.z
        ]);
        mat4.rotateZ(modelMatrix, this.yaw);
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
        // render
        render.drawBuffer(this.buffer);
    }

    destroy(render) {
        render.gl.deleteBuffer(this.buffer);
    }

    isAlive() {
        /*var pos = new Vector(parseInt(this.pos.x), parseInt(this.pos.y), parseInt(this.pos.z));
        var chunk_pos = Game.world.chunkManager.getChunkPos(pos.x, pos.y, pos.z);
        var chunk = Game.world.chunkManager.getChunk(chunk_pos);
        if(chunk) {
            if(pos.z < chunk.lightmap[pos.x][pos.y]) {
                this.life = 0;
            }
        }
        */
        return this.life > 0;
    }

}