import {ObjectDrawer} from "../batch/ObjectDrawer.js";
import {BaseLineShader} from "../BaseShader.js";
import type {IvanArray} from "../../helpers";
import type {GeomCopyOperation} from "../../geom/big_geom_batch_update";
import type {SillyGeometryVao} from "../../geom/silly_geometry_vao";

const vertex = `#version 300 es
precision highp float;
precision highp int;

in vec4 a_silly1;
in vec4 a_silly2;
in vec4 a_silly3;
in vec4 a_silly4;

out vec4 v_silly1;
out vec4 v_silly2;
out vec4 v_silly3;
out vec4 v_silly4;

void main() {
    v_silly1 = a_silly1;
    v_silly2 = a_silly2;
    v_silly3 = a_silly3;
    v_silly4 = a_silly4;
    gl_PointSize = 0.0;
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;

out vec4 outColor;

void main() {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

export class WebGLSillyShader extends BaseLineShader {
    [key: string]: any;
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor(context) {
        super(context, {});

        this.program = context.createProgram({vertex, fragment, tfVaryings: ["v_silly1", "v_silly2", "v_silly3", "v_silly4"]}, {});
        this.locateAttribs();
        this.globalID = -1;
    }

    locateAttribs() {
        const { program } = this;
        const { gl } = this.context;
        this.a_silly1 = gl.getAttribLocation(program, 'a_silly1');
        this.a_silly2 = gl.getAttribLocation(program, 'a_silly2');
        this.a_silly3 = gl.getAttribLocation(program, 'a_silly3');
        this.a_silly4 = gl.getAttribLocation(program, 'a_silly4');
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
export class GLSillyDrawer extends ObjectDrawer {
    constructor(context) {
        super(context);
    }

    tf = null;

    init() {
        this.shader = new WebGLSillyShader(this.context);
    }

    batchUpdate(sillyVao: SillyGeometryVao, inBuffer: any, outBuffer: any, copies: IvanArray<GeomCopyOperation>, strideBytes: number) {
        const sillyStride = sillyVao.strideBytes;
        const {gl} = this.context;
        this.shader.bind();

        gl.bindVertexArray(sillyVao.vao);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, sillyVao.transformFeedback);
        if (outBuffer.dirty) {
            // manual big buffer update
            outBuffer.dirty = false;
            if (outBuffer.glLength == 0) {
                outBuffer.bind(gl.COPY_WRITE_BUFFER);
            } else if (outBuffer.bigLength > outBuffer.glLength) {
                //super-smart resize
                const newBuf = gl.createBuffer();
                const oldBuf = outBuffer.buffer;

                gl.bindBuffer(gl.ARRAY_BUFFER, newBuf);
                gl.bufferData(gl.ARRAY_BUFFER, outBuffer.bigLength, gl.STATIC_COPY);

                gl.bindBuffer(gl.ARRAY_BUFFER, oldBuf);
                sillyVao.attribBufferPointers(0);
                gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, newBuf);
                gl.beginTransformFeedback(gl.POINTS);
                gl.drawArrays(gl.POINTS, 0, outBuffer.glLength / sillyStride);
                gl.endTransformFeedback(gl.POINTS)
                gl.deleteBuffer(oldBuf);
                outBuffer.bigResize = true;
                outBuffer.buffer = newBuf;
                outBuffer.glLength = outBuffer.bigLength;
            }
        }
        inBuffer.bind();
        sillyVao.attribBufferPointers();
        for (let i = 0; i < copies.count; i++) {
            const op = copies.arr[i];
            gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 0, outBuffer.buffer, op.dst * strideBytes, op.count * strideBytes);
            gl.beginTransformFeedback(gl.POINTS);
            gl.drawArrays(gl.POINTS, op.src * strideBytes / sillyStride, op.count * strideBytes / sillyStride);
            gl.endTransformFeedback(gl.POINTS);
        }
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    }

    draw(geom) {
        // nothing
    }
}
