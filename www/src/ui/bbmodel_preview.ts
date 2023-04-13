import { ChunkGrid } from "../core/ChunkGrid.js"
import { GameSettings } from "../game.js"
import { Vector } from "../helpers.js"
import { ChunkDataTexture } from "../light/ChunkDataTexture.js"
import { RendererBBModel } from "../render_bbmodel.js"
import { Resources } from "../resources.js"
import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import { BLOCK } from "../blocks.js"
import type { Mesh_Object_BBModel } from "../mesh/object/bbmodel.js"

const {mat4} = glMatrix;

export class BBModel_Preview {

    #_stop = false

    render: RendererBBModel
    m4 = mat4.create()
    prev_time: float = performance.now()
    mesh?: Mesh_Object_BBModel

    //
    camRot : Vector = new Vector(0, 0, 0)
    camPos : Vector = new Vector(1, 1.7, -.7)

    async init() {

        if(this.render) {
            return
        }

        this.render = new RendererBBModel('bbmodel_preview')
        const renderBackend = this.render.renderBackend
  
        // load resources
        await Resources.preload({
            imageBitmap:    true,
            glsl:           renderBackend.kind === 'webgl',
            wgsl:           renderBackend.kind === 'webgpu'
        })

        await renderBackend.init({
            shaderPreprocessor: Resources.shaderPreprocessor
        })

        // Create world
        const world = {
            settings: new GameSettings(),
            players: null,
            block_manager: null,
            mobs: null,
            chunkManager: {
                grid: new ChunkGrid({chunkSize: new Vector(16, 40, 16)}),
                chunkDataTexture: new ChunkDataTexture()
            },
        } as any

        const player = {
            rotate: new Vector(0, 0, Math.PI * 1.15),
            lerpPos: new Vector(1, .7, 1)
        } as any

        this.render.world = world
        this.render.player = player

        // Init blocks
        await BLOCK.init(world.settings)
        // BLOCK.reset()
        // BLOCK.resource_pack_manager = new ResourcePackManager(BLOCK)
        // await BLOCK.resource_pack_manager.init(world.settings)
        // BLOCK.reset()

        world.block_manager = BLOCK
        await this.render.init(world, world.settings)
        this.render.camPos = this.camPos

        // Add humanoid mesh
        this.mesh = this.render.addBBModel(player.lerpPos, 'mob/humanoid', player.rotate, 'walk', 'humanoid')

        // hide armor groups
        for(const group of this.mesh.model.groups.values()) {
            if(group.name == 'helmet' || group.name.startsWith('chestplate')) {
                group.visibility = false
            }
        }

        // Start render loop
        this.preLoop = this.preLoop.bind(this)
        this.preLoop()

    }

    stop() {
        this.#_stop = true
        // BLOCK.resource_pack_manager.list.clear()
        // BLOCK.list = new Map()
        for(let rp of BLOCK.resource_pack_manager.list.values()) {
            rp.killRender()
        }
    }

    preLoop() {

        if(this.#_stop) {
            return
        }

        this.render.camera.set(this.render.camPos, this.camRot, this.m4)

        // this.mesh.rotate.z =  performance.now() / 1000 * 2 // Math.PI * 1.15

        const delta = performance.now() - this.prev_time
        this.render.draw(delta, undefined)
        this.prev_time = performance.now()

        this.render.requestAnimationFrame(this.preLoop)
    }

}