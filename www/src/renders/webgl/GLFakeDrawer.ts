import {ObjectDrawer} from "../batch/ObjectDrawer.js";
import {BaseLineShader} from "../BaseShader.js";

const vertex = `#version 300 es
precision highp float;

in float a_floppa;

void main() {
    gl_Position = vec4(a_floppa, 0.0, -1.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;

out vec4 outColor;

void main() {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

export class WebGLFakeShader extends BaseLineShader {
    [key: string]: any;
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor(context) {
        super(context, {});

        this.program = context.createProgram({vertex, fragment}, {});
        this.locateAttribs();
        this.globalID = -1;
    }

    locateAttribs() {
        const { program } = this;
        const { gl } = this.context;
        this.a_floppa = gl.getAttribLocation(program, 'a_floppa');
    }

    bind(force = false) {
        const {gl} = this.context;
        const prevShader = this.context._shader;
        if (prevShader === this && !force)
        {
            return;
        }
        if (prevShader) {
            prevShader.unbind();
        }
        this.context._shader = this;
        gl.useProgram(this.program);
    }

    unbind() {
        this.context._shader = null;
    }
}

/**
 * PixiJS BatchRenderer for chunk array
 */
export class GLFakeDrawer extends ObjectDrawer {
    constructor(context) {
        super(context);
    }

    init() {
        this.shader = new WebGLFakeShader(this.context);
    }

    draw(geom) {
        this.shader.bind();
        geom.bind(this.shader);
        const {gl} = this.context;
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
}
