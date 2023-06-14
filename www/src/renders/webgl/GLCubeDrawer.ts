import {ObjectDrawer} from "../batch/ObjectDrawer.js";
import {DRAW_MODES, ExtensionType} from "vauxcel";

export class GLCubeDrawer extends ObjectDrawer {
    static extension = {
        name: 'cube',
        type: ExtensionType.RendererPlugin,
    };
    draw(cube) {
        const { context } = this;
        const { pixiRender } = context;
        cube.shader.bind();
        pixiRender.geometry.bind(cube.geom);
        context.pixiRender.state.set(cube.state);
        pixiRender.geometry.draw(DRAW_MODES.TRIANGLES);
        // stat
        context.stat.drawquads += 6;
        context.stat.drawcalls++;
        pixiRender.geometry.reset();
    }
}