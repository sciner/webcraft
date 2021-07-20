class Particles_Block_Destroy {

    // Constructor
    constructor(gl, block, pos) {
        this.yaw        = -Game.world.localPlayer.angles[2];
        this.life       = .5;
        var lm          = new Color(0, 0, 0, 0);
        var n           = NORMALS.UP; // normal for lithning
        this.texture    = BLOCK.fromId(block.id).texture;
        if(typeof this.texture != 'function') {
            this.life = 0;
            return;
        }
        var c           = calcTexture(this.texture(this, null, 1, null, null, null, DIRECTION.FORWARD)); // полная текстура
        this.pos        = new Vector(
            pos.x + .5 - Math.cos(this.yaw + Math.PI / 2) * .5,
            pos.y + .5,
            pos.z + .5 - Math.sin(this.yaw + Math.PI / 2) * .5
        );
        this.vertices   = [];
        this.particles  = [];
        //
        for(var i = 0; i < 30; i++) {
            const sz        = Math.random() * (3 / 16) + 1 / 16; // часть текстуры
            const half      = sz / TX_CNT;
            // случайная позиция в текстуре
            var cx = c[0] + Math.random() * (half * 3);
            var cy = c[1] + Math.random() * (half * 3);
            var c_half = [cx, cy, cx + half, cy + half];
            // случаная позиция частицы (в границах блока)
            var x = (Math.random() - Math.random()) * .5;
            var y = (Math.random() - Math.random()) * .5;
            var z = (Math.random() - Math.random()) * .5;
            push_plane(this.vertices, x, y, z, c_half, lm, n, true, false, sz, sz, null);
            var p = {
                x:              x,
                y:              y,
                z:              z,
                vertices_count: 12,
                gravity:        .06,
                speed:          .00375
            };
            var d = Math.sqrt(p.x * p.x + p.z * p.z);            
            p.x = p.x / d * p.speed;
            p.z = p.z / d * p.speed;
            this.particles.push(p);
        }
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
        //
        this.life -= delta / 100000;
        //
        var idx = 0;
        for(var p of this.particles) {
            for(var i = 0; i < p.vertices_count; i++) {
                var j = (idx + i) * 12;
                this.vertices[j + 0] += p.x * delta * p.speed;
                this.vertices[j + 1] += p.z * delta * p.speed;
                this.vertices[j + 2] += (delta / 1000) * p.gravity;
            }
            idx += p.vertices_count;
            p.gravity -= delta / 250000;
        }
        //
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
        //
        mat4.identity(modelMatrix);
        var a_pos = new Vector(this.pos.x - Game.shift.x, this.pos.z - Game.shift.z, this.pos.y - Game.shift.y);
        mat4.translate(modelMatrix, [a_pos.x, a_pos.y, a_pos.z]);
        mat4.rotateZ(modelMatrix, this.yaw);
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
        // render
        render.drawBuffer(this.buffer, a_pos);
    }

    destroy(render) {
        render.gl.deleteBuffer(this.buffer);
    }

    isAlive() {
        return this.life > 0;
    }

}