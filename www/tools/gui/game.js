import { BLOCK } from "../../js/blocks.js";
import { Renderer } from "../../js/render.js";
import { Resources } from "../../js/resources.js";

export async function initRender(callback) {
    const render = new Renderer('renderTarget')

    // we can use it both
    const resourceTask = Resources.load({
        imageBitmap:    true,
        glsl:           render.renderBackend.kind === 'webgl',
        wgsl:           render.renderBackend.kind === 'webgpu'
    });
    //
    const blockTask = BLOCK.init({})
    await Promise.all([resourceTask, blockTask])
    await render.init(Qubatch.world, {disable_env: true, generate_prev_callback: (inventory_image) => {
        callback({render, inventory_image})
    }})

}