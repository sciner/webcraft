import { DEFAULT_TX_SIZE } from "../constant.js";
import { Vector } from "../helpers.js";
import { Resources } from "../resources.js";
import { BBModel_Compiler_Base } from "./compiler_base.js";
import { BBModel_Model } from "./model.js";

class FastCompiller extends BBModel_Compiler_Base {
    [key: string]: any;

    createTextureID() {
        const resp = randomUUID()
        return resp
    }

}

export class BBModel_DropPaste {
    [key: string]: any;

    /** 
     * @param { import("../game.js").GameClass } game
     */
    constructor(game) {

        this.game = game;

        const player = game.player
        const previous_meshes = new Map()
        const previous_textures = []
        const previous_bbmodels = []

        function deletePrevious() {
            // 1. delete previous meshes
            for(const key of previous_meshes.keys()) {
                game.render.meshes.remove(key, game.render)
                previous_meshes.delete(key)
            }
            // 2. delete previous textures
            for(let t of previous_textures) {
                t.destroy()
            }
            previous_textures.length = 0
            // 3.
            for(let t of previous_bbmodels) {
                Resources._bbmodels.delete(t)
            }
            previous_bbmodels.length = 0
        }

        const dropZone = document.getElementById('qubatchRenderSurface')

        dropZone.addEventListener('dragover', function(e) {
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        const options = {
            resolution: 32,
            tx_cnt: 32
        }

        // Get file data on drop
        dropZone.addEventListener('drop', function(e) {

            const pn = performance.now()

            e.stopPropagation()
            e.preventDefault()

            const files = e.dataTransfer.files // array of all files
            
            const pos = player.lerpPos.clone()

            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                if(file.name.endsWith('.bbmodel')) {
                    const reader = new FileReader()
                    reader.onload = async function(e2) {

                        deletePrevious()

                        const json = JSON.parse(this.result)

                        json._properties = {
                            shift: new Vector(0, 0, 0)
                        }

                        const compiler = new FastCompiller(options)
                        const {spritesheet} = await compiler.prepareModel(json, json.name, options)

                        /**
                         * @type {BaseResourcePack}
                         */
                        const resource_pack = game.render.world.block_manager.resource_pack_manager.get('bbmodel')
                        const renderBackend = game.render.renderBackend

                        // Register model
                        const model = new BBModel_Model(json)
                        model.parse()
                        model.name = randomUUID() // json?.name ?? file.name
                        Resources._bbmodels.set(model.name, model)
                        previous_bbmodels.push(model.name)

                        json._properties.texture_id = spritesheet.id
                        json._properties.places = []

                        // Create textures
                        for(const [subtexture_id, item] of spritesheet.canvases) {

                            const cnv = item.cnv
                            const settings_for_canvas = {
                                mipmap: false
                            }

                            const texture = renderBackend.createTexture({
                                source: cnv,
                                style: resource_pack.genTextureStyle(cnv, settings_for_canvas, DEFAULT_TX_SIZE),
                                minFilter: 'nearest',
                                magFilter: 'nearest',
                            });

                            previous_textures.push(texture)
                
                            const textureInfo = {
                                texture: texture,
                                width: cnv.width,
                                height: cnv.height,
                                texture_n: null
                            }

                            console.debug(`Register resource_pack texture: "${model.name}"`, textureInfo)
                            resource_pack.textures.set(spritesheet.id, textureInfo)

                        }

                        const animations = Array.from(model.animations.keys())
                        if(animations.length == 0) animations.push(null)

                        // Create meshes for each animation
                        for(const animation_name of animations) {
                            pos.addScalarSelf(
                                Math.sin(player.rotate.z) * 2,
                                0,
                                Math.cos(player.rotate.z) * 2,
                            )
                            const key = randomUUID()
                            const mesh = game.render.addBBModel(pos, model.name, player.rotate.add(new Vector(0, 0, Math.PI)), animation_name, key)
                            previous_meshes.set(key, mesh)
                        }

                    }

                    // start reading the file data
                    reader.readAsText(file)

                }
            }
        });

    }

}