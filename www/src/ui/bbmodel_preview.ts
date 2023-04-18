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

    #_active:       boolean = false
    render:         RendererBBModel
    m4:             any = mat4.create()
    prev_time:      float = performance.now()
    mesh?:          Mesh_Object_BBModel
    mesh2?:         Mesh_Object_BBModel
    camRot:         Vector = new Vector(0, 0, 0)
    camPos:         Vector = new Vector(1, 1.7, -.7)
    intv: NodeJS.Timer

    async init() {

        if(this.render) {
            return
        }

        this.#_active = true

        let p = performance.now()

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

        // Add humanoid mesh #1
        this.mesh = this.render.addBBModel(player.lerpPos.add(new Vector(-.5, 0, 1)), 'mob/humanoid', player.rotate, 'idle', 'humanoid')
        // this.mesh.modifiers.appendToGroup('head', 'tool/sunglasses')
        // this.mesh.modifiers.appendToGroup('RightArmItemPlace', 'tool/iron_sword', 'thirdperson_righthand')
        this.mesh.modifiers.replaceGroup('chestplate0', 'armor/scrap_armor', 'scrap_armor_copper.png')
        this.mesh.modifiers.replaceGroup('chestplate4', 'armor/scrap_armor', 'scrap_armor_diamond.png')
        this.mesh.modifiers.replaceGroup('chestplate5', 'armor/scrap_armor', 'scrap_armor_diamond.png')
        this.mesh.modifiers.replaceGroup('boots0', 'armor/scrap_armor', 'scrap_armor_diamond.png')
        this.mesh.modifiers.replaceGroup('boots1', 'armor/scrap_armor', 'scrap_armor_copper.png')
        this.mesh.modifiers.hideGroup('backpack')
        // this.mesh.modifiers.showGroup('backpack')

        let demo_animation_frame = 0
        // const demo_animations = ['walk', 'idle', 'eat', 'sitting', 'sleep']
        const demo_animations = ['walk', 'sitting', 'idle', 'eat', 'sleep']
        this.intv = setInterval(() => {
            // this.mesh.setAnimation(demo_animations[++demo_animation_frame % demo_animations.length])
        }, 2000)

        // Add humanoid mesh #2
        this.mesh2 = this.render.addBBModel(player.lerpPos.add(new Vector(.5, 0, 0)), 'mob/humanoid', player.rotate.clone(), 'walk', 'humanoid2')
        this.mesh2.modifiers.appendToGroup('RightArmItemPlace', 'tool/iron_sword', 'thirdperson_righthand')
        this.mesh2.modifiers.replaceGroup('chestplate0', 'armor/scrap_armor', 'scrap_armor_copper.png')
        this.mesh2.modifiers.replaceGroup('chestplate4', 'armor/scrap_armor', 'scrap_armor_diamond.png')
        this.mesh2.modifiers.replaceGroup('chestplate5', 'armor/scrap_armor', 'scrap_armor_diamond.png')
        this.mesh2.modifiers.replaceGroup('boots0', 'armor/scrap_armor', 'scrap_armor_diamond.png')
        this.mesh2.modifiers.replaceGroup('boots1', 'armor/scrap_armor', 'scrap_armor_copper.png')

        // Start render loop
        this.loop = this.loop.bind(this)
        this.loop()
        // console.debug(performance.now() - p)

    }

    stop() {
        if(this.#_active) {
            this.#_active = false
            // BLOCK.resource_pack_manager.list.clear()
            // BLOCK.list = new Map()
            this.render.renderBackend.destroy();
            clearInterval(this.intv)
            for(let rp of BLOCK.resource_pack_manager.list.values()) {
                rp.killRender()
            }
        }
    }

    loop() {

        if(!this.#_active) {
            return
        }

        this.render.camera.set(this.render.camPos, this.camRot, this.m4)

        // this.mesh.rotate.z = performance.now() / 1000 // Math.PI * 1.15
        this.mesh.rotation[2] = Math.PI * 1.15
        if(this.mesh2) {
            this.mesh2.rotation[2] = performance.now() / 1000
        }

        const delta = performance.now() - this.prev_time
        this.render.draw(delta, undefined)
        this.prev_time = performance.now()

        this.render.requestAnimationFrame(this.loop)
    }

}