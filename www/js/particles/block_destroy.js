class Particles_Block_Destroy {

    // Constructor
    constructor(gl, block, pos) {

        this.texture    = BLOCK.fromId(block.id).texture;
        // полная текстура
        var c           = calcTexture(this.texture(this, null, null, null, null, null, DIRECTION.FORWARD));
        this.pos        = new Vector(
            pos.x + .25,
            pos.y,
            pos.z + .25
        );
        this.yaw = Game.world.localPlayer.angles[1] / Math.PI;
        this.life = 0.25;

        // четверть текстуры
        const half  = 0.25 / TX_CNT;
        var c_half = [
            c[0],
            c[1],
            c[2] - half,
            c[3] - half,
        ];

        var lm = new Color(0, 0, 0, 1);
        var width = 1;
        var bH = 1;

        //
        this.vertices = [];
        this.program = [];
        var speed = .01;
        for(var i = 0; i < 30; i++) {
            push_plane(this.vertices, 0, 0, 0, c_half, lm, true, false, .25, null, .25);
            var p = {
                x: (Math.random() - Math.random()) * Math.PI,
                y: (Math.random() - Math.random()) * Math.PI,
                z: (Math.random() - Math.random()) * Math.PI,
                count: 12,
                speed: speed
            };
            var dir = (Math.random() - Math.random()) * Math.PI;
            var d = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);            
            p.x = p.x / d * p.speed;
            p.y = p.y / d * p.speed;
            p.z = p.z / d * p.speed;
            this.program.push(p);
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
        for(var p of this.program) {
            for(var i = 0; i < p.count; i++) {
                this.vertices[(idx + i) * 12 + 0] += p.x * delta * p.speed;
                this.vertices[(idx + i) * 12 + 1] += p.y * delta * p.speed;
                this.vertices[(idx + i) * 12 + 2] += p.z * delta * p.speed;
            }
            idx += p.count;
        }
        //
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
        //

        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, [this.pos.x - Game.shift.x, this.pos.y - Game.shift.y, this.pos.z]);
        mat4.rotateZ(modelMatrix, this.yaw);
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);

        render.drawBuffer(this.buffer);
    }

    destroy(render) {
        render.gl.deleteBuffer(this.buffer);
    }

    isAlive() {
        return this.life > 0;
    }

}