class GeometryTerrain {
    constructor(vertices) {
        this.vertices = vertices;
        this.updateID = 0;
        this.uploadID = -1;

        this.stride = 12;

        if (vertices instanceof Array) {
            this.data = new Float32Array(vertices);
        } else {
            this.data = vertices;
        }
        this.size = this.data.length / this.stride;

        this.glSize = 0;
        this.glBuffer = 0;
        this.vao = null;
    }

    createVao()
    {
        const { attribs, gl } = this;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        gl.enableVertexAttribArray(attribs.a_position);
        gl.enableVertexAttribArray(attribs.a_texcoord);
        gl.enableVertexAttribArray(attribs.a_color);
        gl.enableVertexAttribArray(attribs.a_normal);

        this.glBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.DYNAMIC_DRAW);
        this.glSize = this.data.length;

        gl.vertexAttribPointer(attribs.a_position, 3, gl.FLOAT, false, 12 * 4, 0);
        gl.vertexAttribPointer(attribs.a_color, 4, gl.FLOAT, false, 12 * 4, 5 * 4);
        gl.vertexAttribPointer(attribs.a_texcoord, 2, gl.FLOAT, false, 12 * 4, 3 * 4);
        gl.vertexAttribPointer(attribs.a_normal, 3, gl.FLOAT, false, 12 * 4, 9 * 4);
    }

    bind(render)
    {
        if (render) {
            this.attribs = render;
            this.gl = render.gl;
        }

        const { gl } = this;
        if (!this.vao) {
            this.createVao();
            this.uploadID = this.updateID;
            return;
        }
        gl.bindVertexArray(this.vao);
        if (this.uploadID === this.updateID) {
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
        if (this.glSize < this.data.length) {
            gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.DYNAMIC_DRAW);
            this.glSize = this.data.length;
        } else {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data);
        }
    }

    updateInternal(data) {
        if (data) {
            if (data instanceof Array) {
                this.data = new Float32Array(data);
            } else {
                this.data = data;
            }
        }
        this.size = data.length / this.stride;
        this.updateID++;
    }

    destroy() {
        if (this.glBuffer) {
            this.gl.deleteBuffer(this.glBuffer);
            this.glBuffer = null;
            this.gl.deleteVertexArray(this.vao);
            this.vao = null;
        }
    }
}
