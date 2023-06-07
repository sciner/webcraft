import {ObjectDrawer} from "../batch/ObjectDrawer.js";

export class GLCubeDrawer extends ObjectDrawer {
    [key: string]: any;

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

        context.pixiRender.state.set(cube.state);
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
        // stat
        context.stat.drawquads += 6;
        context.stat.drawcalls++;
    }
}