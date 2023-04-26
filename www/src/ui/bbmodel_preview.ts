import { ChunkGrid } from "../core/ChunkGrid.js"
import { GameSettings } from "../game.js"
import { Vector } from "../helpers.js"
import { ChunkDataTexture } from "../light/ChunkDataTexture.js"
import { RendererBBModel } from "../render_bbmodel.js"
import { Resources } from "../resources.js"
import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import { BLOCK } from "../blocks.js"
import type { Mesh_Object_BBModel } from "../mesh/object/bbmodel.js"

const {mat4} = glMatrix

export declare type IPlayerSkin = {
    id:            string,
    model_name:    string,
    texture_name:  string,
    mesh?:         Mesh_Object_BBModel,
}

export class BBModel_Preview {
    #_active:       boolean = false
    render:         RendererBBModel
    m4:             any = mat4.create()
    prev_time:      float = performance.now()
    mesh?:          Mesh_Object_BBModel
    mesh2?:         Mesh_Object_BBModel
    camRot:         Vector = new Vector(0, 0, 0)
    camPos:         Vector = new Vector(1, 1.7, -.7)
    intv:           NodeJS.Timer
    skins:          IPlayerSkin[] = []
    current:        IPlayerSkin
    index:          int = 0
    count:          int = 0

    async init(skins: IPlayerSkin[], callback : Function) {

        if(this.render) {
            return
        }

        this.#_active = true

        // let p = performance.now()

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

        this.skins = []
        for(let skin_item of skins) {
            const id = skin_item.id
            const mesh = this.render.addBBModel(player.lerpPos.add(new Vector(0, 0, 0)), skin_item.model_name, player.rotate, 'idle', id)
            mesh.visible = this.skins.length == 0
            mesh.modifiers.selectTextureFromPalette('', skin_item.texture_name)
            skin_item.mesh = mesh
            if(mesh.visible) {
                this.current = skin_item
            }
            this.skins.push(skin_item)
            this.count++
        }

        // Add humanoid mesh #1
        // this.mesh = this.render.addBBModel(player.lerpPos.add(new Vector(0, 0, 0)), MOB_TYPE.HUMANOID, player.rotate, 'idle', 'humanoid')
        // this.mesh.modifiers.selectTextureFromPalette('', 'CHARACTER')
        // this.mesh.modifiers.appendToGroup('head', 'tool/sunglasses')
        // this.mesh.modifiers.appendToGroup('RightArmItemPlace', 'tool/sword', 'thirdperson_righthand')
        // this.mesh.modifiers.replaceGroup('chestplate0', 'armor/scrap_armor', 'scrap_armor_copper')
        // this.mesh.modifiers.replaceGroup('chestplate4', 'armor/scrap_armor', 'scrap_armor_diamond')
        // this.mesh.modifiers.replaceGroup('chestplate5', 'armor/scrap_armor', 'scrap_armor_diamond')
        // this.mesh.modifiers.replaceGroup('boots0', 'armor/scrap_armor', 'scrap_armor_diamond')
        // this.mesh.modifiers.replaceGroup('boots1', 'armor/scrap_armor', 'scrap_armor_copper')
        // this.mesh.modifiers.hideGroup('backpack')
        // this.mesh.modifiers.showGroup('backpack')

        let demo_animation_frame = 0
        const demo_animations = ['walk', 'emote_hi', 'idle' /*'sitting', 'eat', 'sleep',*/]
        this.intv = setInterval(() => {
            this.current.mesh.setAnimation(demo_animations[++demo_animation_frame % demo_animations.length])
        }, 4000)

        // Add humanoid mesh #2
        // this.mesh2 = this.render.addBBModel(player.lerpPos.add(new Vector(.5, 0, 0)), MOB_TYPE.HUMANOID, player.rotate.clone(), 'walk', 'humanoid2')
        // this.mesh2.modifiers.selectTextureFromPalette('', 'CHARACTER_F')

        // this.mesh2.modifiers.appendToGroup('RightArmItemPlace', 'tool/sword', 'thirdperson_righthand')
        // this.mesh2.modifiers.replaceGroup('chestplate0', 'armor/scrap_armor', 'scrap_armor_copper')
        // this.mesh2.modifiers.replaceGroup('chestplate4', 'armor/scrap_armor', 'scrap_armor_diamond')
        // this.mesh2.modifiers.replaceGroup('chestplate5', 'armor/scrap_armor', 'scrap_armor_diamond')
        // this.mesh2.modifiers.replaceGroup('boots0', 'armor/scrap_armor', 'scrap_armor_diamond')
        // this.mesh2.modifiers.replaceGroup('boots1', 'armor/scrap_armor', 'scrap_armor_copper')

        // Start render loop
        this.loop = this.loop.bind(this)
        this.loop()

        callback()
        // console.debug(performance.now() - p)

    }

    prev() {
        this.index = --this.index
        if(this.index < 0) {
            this.index = this.count - 1
        }
        this.current.mesh.visible = false
        this.current = this.skins[this.index]
        this.current.mesh.visible = true
    }

    next() {
        this.index = ++this.index % this.count
        this.current.mesh.visible = false
        this.current = this.skins[this.index]
        this.current.mesh.visible = true
    }

    select(skin_id: string) {
        let next_item = null
        let next_index = 0
        for(let item of this.skins) {
            if(item.id == skin_id) {
                next_item = item
                break
            }
            next_index++
        }
        if(next_item) {
            this.index = next_index
            this.current.mesh.visible = false
            next_item.mesh.visible = true
            this.current = next_item
        }
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

    get isActive() : boolean {
        return this.#_active
    }

    loop() {

        if(!this.#_active) {
            return
        }

        this.render.camera.set(this.render.camPos, this.camRot, this.m4)

        const item = this.current
        // item.mesh.rotation[2] = Math.PI * 1.15
        item.mesh.rotation[2] = performance.now() / 1000

        const delta = performance.now() - this.prev_time
        this.render.draw(delta, undefined)
        this.prev_time = performance.now()

        this.render.requestAnimationFrame(this.loop)
    }

}