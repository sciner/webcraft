import {ObjectDrawer} from "../batch/ObjectDrawer.js";

export class GLCubeDrawer extends ObjectDrawer {
    draw(cube) {
        const { context } = this;
        if (context._mat) {
            context._mat.unbind();
            context._mat = null;
        }
        cube.shader.bind();
        cube.geom.bind(cube.shader);

        const  {
            gl
        } = context;

        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        // stat
        context.stat.drawquads += 6;
        context.stat.drawcalls++;
    }
}