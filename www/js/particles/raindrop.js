class Particles_Raindrop {

    // Constructor
    constructor(gl, pos) {
        this.yaw        = -Game.world.localPlayer.angles[1];
        this.life       = 1;
        var lm          = new Color(0, 0, 0, 4); // lithning normal
        var width       = 1;
        var bH          = 1;
        this.texture    = BLOCK.STILL_WATER.texture;
        var c           = calcTexture(this.texture(this, null, 1, null, null, null, DIRECTION.FORWARD)); // полная текстура
        this.pos        = new Vector(pos.x, pos.y, pos.z);
        this.vertices   = [];
        this.particles  = [];
        //
        for(var i = 0; i < 50; i++) {
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
            push_plane(this.vertices, x, y, z, c_half, lm, true, false, sz / 3, null, sz);
            var p = {
                x:              x,
                y:              y,
                z:              z,
                vertices_count: 12,
                gravity:        -.40,
                speed:          .00375 * 2
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
        //
        var idx = 0;
        var j = 0;
        for(var p of this.particles) {
            var plus = delta * p.gravity;
            for(var i = 0; i < p.vertices_count; i++) {
                // var j = (idx + i) * 12;
                j += 12;
                this.vertices[j + 2] += plus;
            }
            idx += p.vertices_count;
        }
        //
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
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
        return this.life > 0;
    }

}