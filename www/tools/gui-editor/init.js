import { Window, WindowManager } from "../gui/wm.js"
import { Lang } from "../../js/lang.js"
import { Resources } from "../../js/resources.js"
import { Renderer } from "../../js/render.js"

let wm
let render
let renderBackend

function loop() {
    renderBackend.resetAfter()
    wm.draw()
    renderBackend.resetBefore();
    render.requestAnimationFrame(loop)
}

//
export async function initEditor(canvas_id) {

    await Lang.init({
        lang_file: '/data/lang.json'
    })

    const canvas = document.getElementById(canvas_id)
    render = new Renderer(canvas.id)
    renderBackend = render.renderBackend
    
    // we can use it both
    await Resources.preload({
        imageBitmap:    true,
        glsl:           renderBackend.kind === 'webgl',
        wgsl:           renderBackend.kind === 'webgpu'
    })
    
    await renderBackend.init({
        blocks: Resources.shaderBlocks
    })
    
    render.resetAfter()
    wm = new WindowManager(canvas, 0, 0, canvas.width, canvas.height, true)
    wm.initRender(render)
    render.resetBefore()

    // рамка активного контрола, под курсором
    const selector = new Window(0, 0, 0, 0, 'selector')
    selector.catchEvents = false
    selector.style.border.hidden = false
    selector.style.background.color = '#00aaff55'
    wm._wmoverlay.add(selector) // добавление его на "рабочий стол"

    // Start drawing HUD with loading screen
    render.requestAnimationFrame(loop)

    return {wm, render, renderBackend, Lang, selector}

}
