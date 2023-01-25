import { Renderer } from "../../js/render.js";
import { Resources } from "../../js/resources.js";

export async function initRender(callback) {

    const render = new Renderer('renderTarget')

    // we can use it both
    await Resources.load({
        imageBitmap:    true,
        glsl:           render.renderBackend.kind === 'webgl',
        wgsl:           render.renderBackend.kind === 'webgpu'
    });

    await render.init(Qubatch.world, {disable_env: true, generate_prev_callback: (inventory_image) => {
        callback({render, inventory_image})
    }})

}