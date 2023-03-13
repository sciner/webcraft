import {GradientGraphics, Label, Window, WindowManager} from "../tools/gui/wm.js";
import {MainMenu} from "./window/index.js";
import {FPSCounter} from "./fps.js";
import {GeometryTerrain16} from "./geom/TerrainGeometry16.js";
import { isMobileBrowser, Vector } from "./helpers.js";
import {Resources} from "./resources.js";
import { DRAW_HUD_INFO_DEFAULT, HUD_CONNECTION_WARNING_INTERVAL, ONLINE_MAX_VISIBLE_IN_F3 } from "./constant.js";
import { Lang } from "./lang.js";
import { Mesh_Effect } from "./mesh/effect.js";
import type {GameClass} from "./game.js";

// QuestActionType
export enum QuestActionType {

    PICKUP       = 1, // Добыть
    CRAFT        = 2, // Скрафтить
    SET_BLOCK    = 3, // Установить блок
    USE_ITEM     = 4, // Использовать инструмент
    GOTO_COORD   = 5, // Достигнуть координат

}

class HUDLabel extends Label {
    [key: string]: any;

    constructor(x, y, w, h, id) {
        super(x, y, w, h, id)
        this.style.font.size = 16
        this.style.font.family = 'UbuntuMono-Regular'
        this.text = '';
    }

}

class HUDWindow extends Window {
    [key: string]: any;

    noConnectionWarning: Window

    constructor(wm, x, y, w, h) {
        super(x, y, w, h, 'hudwindow')
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom
        this.addChild(this.splash = GradientGraphics.createVertical('#1c1149', '#66408d', 512))
        this.add(this.progressbar = new Window(0, 0, 0, 4 * this.zoom, 'hud_progressbar'))
        this.progressbar.style.background.color = '#ffffff55'

        // Loading...
        this.add(this.lbl_loading = new Window(x, y, w, h, 'lbl_loading', undefined, Lang.loading))
        this.lbl_loading.style.textAlign.horizontal = 'center'
        this.lbl_loading.style.textAlign.vertical = 'middle'
        this.lbl_loading.style.font.color = '#ffffff'

        this.add(this.noConnectionWarning = new Window(x, 100, w, 0, 'hud_connection_info', undefined, ''))
        this.noConnectionWarning.style.textAlign.horizontal = 'center'
        this.noConnectionWarning.style.font.color = '#ff0000'
        this.noConnectionWarning.visible = false

        // Kb tips
        const kb_tips = [
            {key: 'WASD', tip: Lang.kb_help_wasd},
            {key: 'F4', tip: Lang.kb_help_f4},
            {key: 'R', tip: Lang.kb_help_r},
            {key: '0-9', tip: Lang.kb_help_09},
            {key: Lang.mouse_button_left, tip: Lang.kb_help_lm},
            {key: Lang.mouse_button_right, tip: Lang.kb_help_rm},
            {key: Lang.mouse_wheel, tip: Lang.kb_help_mm},
            {key: Lang.kb_help_ctrlw_key, tip: Lang.kb_help_ctrlw},
            // Lang.lbl_other
            {key: 'F10', tip: Lang.change_game_mode}
        ]
        this.add(this.kb_tips = new Window(x, y, w, h, 'hud_splash_kb_tips', undefined, ''))
        this.kb_tips.style.textAlign.vertical = 'bottom'
        this.kb_tips.style.font.color = '#ffffff'
        this.kb_tips.style.padding.set(10 * this.zoom, 5 * this.zoom)
        const kb_tips_text = []
        for(const tip of kb_tips) {
            kb_tips_text.push(`${tip.key}: ${tip.tip}`)
        }
        this.kb_tips.text = kb_tips_text.join('\n')

    }

    update(width, height, loading, loading_parts) {
        this.noConnectionWarning.visible = false
        if(!loading) {
            this.progressbar.visible = false
            this.kb_tips.visible = false
            //
            const sinceLastPacket = performance.now() - Qubatch.world.server.lastPacketReceivedTime
            if (sinceLastPacket > HUD_CONNECTION_WARNING_INTERVAL) {
                this.noConnectionWarning.visible = true
                this.noConnectionWarning.w = width
                this.noConnectionWarning.style.padding._changed()
                this.noConnectionWarning.text = Lang[`no_connection|${sinceLastPacket * 0.001 | 0}`]
            }
        } else {
        }
        this.lbl_loading.visible = loading
        this.lbl_loading.w = width
        this.lbl_loading.h = height
        this.lbl_loading.style.padding._changed()
        this.kb_tips.h = height
        this.splash.visible = loading
        this.resize(width, height, loading_parts)
    }

    resize(width, height, loading_parts) {
        this.splash.width = width
        this.splash.height = height
        this.progressbar.y = height - this.progressbar.h
        //
        let percent = 0
        loading_parts.map(item => percent += item.percent / loading_parts.length)
        //
        this.progressbar.w = percent * width
    }

}

// Canvas used to draw HUD
export class HUD {
    [key: string]: any;

    constructor(canvas) {

        this.canvas = canvas

        this.active                     = true
        this.draw_info                  = DRAW_HUD_INFO_DEFAULT
        this.draw_block_info            = !isMobileBrowser()
        this.texture                    = null
        this.buffer                     = null
        this.text                       = null
        this.block_text                 = null
        this.items                      = []
        this.prevInfo                   = null
        this.prevDrawTime               = 0
        this.strMeasures                = new Map()
        this.FPS                        = new FPSCounter()

        // Init Window Manager
        const wm = this.wm = new WindowManager(this.canvas, 0, 0, this.canvas.width, this.canvas.height)

        //
        if(!this.wm.hud_window) {
            this.wm.hud_window = new Label(0, 0, this.wm.w, this.wm.h, 'hud')
            this.wm.hud_window.auto_center = false
            this.wm.addChild(this.wm.hud_window)
        }

        // Main menu
        this.frmMainMenu = new MainMenu(10, 10, 352, 332, 'frmMainMenu', null, null)
        wm.add(this.frmMainMenu)

        // HUD window
        const hudwindow = this.hudwindow = new HUDWindow(wm, 0, 0, wm.w, wm.h)
        wm._wmoverlay.addChild(hudwindow)

        // Splash screen (Loading...)
        this.splash = {
            loading:    true,
            image:      null,
            hud:        null,
            generate_terrain_time: 0,
            init: function(hud) {
                this.hud = hud
            },
            draw: function() {
                let cl = 0;
                let nc = 45;
                let player_chunk_loaded = false;
                
                this.generate_terrain_time = 0;
                this.generate_terrain_count = 0;

                // if(Qubatch.world && Qubatch.world.chunkManager) {
                //     const chunkManager = Qubatch.world.chunkManager
                //     this.generate_terrain_time = chunkManager.state.generated.time;
                //     this.generate_terrain_count = cl = chunkManager.state.generated.count;
                //     player_chunk_loaded = Qubatch.player?.getOverChunk()?.inited
                // }

                // const chunk_render_dist = Qubatch.player?.player?.state?.chunk_render_dist || 0;
                const player_chunk_addr = Qubatch.player?.chunkAddr;
                if(Qubatch.world && Qubatch.world.chunkManager) {
                    const chunks_flat = Qubatch.world.chunkManager.chunks.flat
                    const chunks_flat_size = chunks_flat.length
                    for(let i = 0; i < chunks_flat_size; i++) {
                        const chunk = chunks_flat[i]
                        if(chunk && chunk.inited) {
                            if(chunk.timers) {
                                this.generate_terrain_time += chunk.timers.generate_terrain;
                                this.generate_terrain_count++;
                            }
                            cl++;
                            if(player_chunk_addr) {
                                if(player_chunk_addr.equal(chunk.addr)) {
                                    player_chunk_loaded = true; // !!chunk.lightTex;
                                }
                            }
                        }
                    }
                }

                if(this.generate_terrain_count > 0) {
                    this.generate_terrain_time = Math.round(this.generate_terrain_time / this.generate_terrain_count * 100) / 100;
                }
                const chunk_loaded_percent = cl / nc
                this.loading = (chunk_loaded_percent < 1) || !player_chunk_loaded;

                const loading_parts = [
                    {code: 'chunks', percent: Math.min(chunk_loaded_percent, 1)},
                    {code: 'resources', percent: (Resources.progress?.percent ?? 0) / 100}
                ]

                // Splash background
                hudwindow.update(this.hud.width, this.hud.height, this.loading, loading_parts)

                if(!this.loading) {
                    return false
                }

                return true
            }
        };
        this.splash.init(this)

    }

    get width() {
        return this.canvas.width
    }

    get height() {
        return this.canvas.height
    }

    isDrawingBlockInfo() {
        return this.active && this.draw_info && this.draw_block_info;
    }

    get zoom() {
        return UI_ZOOM
    }

    add(item, zIndex) {
        if(!this.items[zIndex]) {
            this.items[zIndex] = [];
        }
        this.items[zIndex].push({item: item});
    }

    refresh() {
        this.need_refresh = true
        this.prepareText()
    }

    //
    toggleActive() {
        this.active = !this.active;
        this.refresh();
    }

    //
    isActive() {
        return this.active;
    }

    draw(force) {

        this.frmMainMenu.parent.center(this.frmMainMenu)

        // Check if need redraw
        this.prepareText()
        this.need_refresh = false;
        this.prevDrawTime = performance.now()

        // Draw splash screen...
        if(this.splash.draw()) {
            this.wm.draw()
            return
        }

        // HUD window
        const hudwindow = this.hudwindow
        const wm = this.wm
        hudwindow.w = wm.w
        hudwindow.h = wm.h

        // Hide all inner text blocks
        for(let c of this.wm.hud_window.children) {
            if(c instanceof HUDLabel) {
                c.visible = false
            }
        }

        if(this.isActive()) {
            // Draw game technical info
            this.drawInfo()
            this.drawAverageFPS()
        }

        for(const item of this.items) {
            for(const e of item) {
                e.item.drawHUD(this)
            }
        }

        // Draw windows
        if(this.wm.hasVisibleWindow()) {
            this.wm.style.background.color = Qubatch.player.isAlive ? '#00000077' : '#ff330027';
        } else {
            this.wm.style.background.color = '#00000000';
        }

        this.wm.draw()

    }

    /**
     * @param {int} width In pixels
     * @param {int} height In pixels
     */
    resize(width, height) {

        // const dpr = window.devicePixelRatio
        // width /= dpr
        // height /= dpr

        this.wm.pixiRender?.resize(width, height);
        this.wm.w = width
        this.wm.h = height

        this.wm.hud_window.w = width
        this.wm.hud_window.h = height

        this.refresh()

    }

    toggleInfo() {
        this.draw_info = !this.draw_info;
        this.refresh();
    }

    //
    prepareText() {

        // If render not inited
        if(!Qubatch.render || !Qubatch.world || !Qubatch.player) {
            return;
        }

        const game              : GameClass = Qubatch;
        const world             = Qubatch.world;
        const player            = Qubatch.player;
        const render            = Qubatch.render;
        const short_info        = isMobileBrowser();
        const draw_player_list  = !short_info
        const draw_tech_info    = true;

        this.text = '';
        if(render.renderBackend.kind != 'webgl') {
            this.text = 'Render: ' + render.renderBackend.kind + '\n';
        }

        // Video card info
        const vci = render.getVideoCardInfo();
        if(!vci.error) {
            this.text += 'Renderer: ' + vci.renderer + '\n';
        }

        // FPS
        this.text += 'FPS: ' + Math.round(this.FPS.fps) + ' / ' + (Math.round(1000 / this.FPS.avg * 100) / 100) + ' ms';

        //
        if(!short_info) {
            this.text += '\nMAT: ';
            const mat = player.currentInventoryItem;
            if(mat) {
                const current_mat_key =  mat.entity_id ?? mat.id;
                if(this.prev_mat_key != current_mat_key) {
                    this.prev_mat_key = current_mat_key;
                    this.mat_name = player.world.block_manager.fromId(mat.id).name;
                    if(mat.extra_data?.label) {
                        this.mat_name = mat.extra_data?.label;
                    }
                }
                this.text += `${mat.id} / ${this.mat_name}`;
                if(mat.is_fluid) {
                    this.text += ' ' + '(FLUID!)';
                }
            } else {
                this.text += 'NULL';
            }
            this.text += '\nGame mode: ' + player.game_mode.getCurrent().title;
            if(player.world.server.ping_value) {
                this.text += '\nPING: ' + Math.round(player.world.server.ping_value) + ' ms';
            }

            // LAG
            this.text += '\nLAG: ' + Math.round(player.world.latency) + 'ms';

            // Day time
            const time = world.getTime();
            if(time) {
                this.text += '\nDay: ' + time.day + ', Time: ' + time.string;
            }

            const trackName = game.sounds.music.track?.name
            if (trackName) {
                this.text += `\nPlaying track: ${trackName}`
            }

            // Chunks inited
            this.text += '\nChunks drawn: ' + Math.round(world.chunkManager.rendered_chunks.fact) + ' / ' + world.chunkManager.rendered_chunks.total + ' (' + player.state.chunk_render_dist + ') ' + this.splash?.generate_terrain_time;

            // Quads and Lightmap
            let quads_length_total = world.chunkManager.vertices_length_total;
            this.text += '\nQuads: ' + Math.round(render.renderBackend.stat.drawquads) + ' / ' + quads_length_total // .toLocaleString(undefined, {minimumFractionDigits: 0}) +
                + ' / ' + Math.round(quads_length_total * GeometryTerrain16.strideFloats * 4 / 1024 / 1024) + 'Mb';
            this.text += '\nLightmap: ' + Math.round(world.chunkManager.lightmap_count)
                + ' / ' + Math.round(world.chunkManager.lightmap_bytes / 1024 / 1024) + 'Mb';

            // Draw tech info
            if(draw_tech_info) {
                this.text += '\nPackets: ' + Qubatch.world.server.stat.out_packets.total + '/' + Qubatch.world.server.stat.in_packets.total; // + '(' + Qubatch.world.server.stat.in_packets.physical + ')';
                if(render) {
                    this.text += '\nParticles: ' + Mesh_Effect.current_count;
                    this.text += '\nDrawcalls: ' + render.renderBackend.stat.drawcalls;
                    if (render.renderBackend.stat.multidrawcalls) {
                        this.text += ' + ' + render.renderBackend.stat.multidrawcalls + '(multi)';
                    }
                }
            }

            const desc = Qubatch.player.pickAt.targetDescription;
            this.block_text = null;
            if (this.draw_block_info && desc) {
                this.block_text = 'Targeted block Id: ' + desc.block.id +
                    '\nName: ' + desc.material.name +
                    '\nStyle: ' + desc.material.style_name +
                    '\nWorld pos.: ' + desc.worldPos.toString() +
                    `\nPos. in chunk: ${desc.posInChunk.toString()}, flat=${desc.posInChunk.relativePosToFlatIndexInChunk()},\n               ind=${desc.posInChunk.relativePosToChunkIndex()}` +
                    '\nChunk addr.: ' + desc.chunkAddr.toString();
                if (desc.material.ticking) {
                    this.block_text += '\nTicking: ' + desc.material.ticking.type;
                }
                if (desc.block.rotate) {
                    this.block_text += `\nrotate: ` + new Vector(desc.block.rotate);
                }
                if (desc.block.entity_id) {
                    this.block_text += '\nentity_id: ' + desc.block.entity_id;
                }
                if (desc.block.power) {
                    this.block_text += '\npower: ' + desc.block.power;
                }
                if (desc.material.is_solid) {
                    this.block_text += ' is_solid ';
                }
                const ed = desc.block.extra_data
                if (ed) {
                    var s = '';
                    for(let key in ed) {
                        s += '\n    ' + key + ': ' + JSON.stringify(ed[key])
                    }
                    this.block_text += '\nextra_data: {' + s + '\n}';
                }
                if (desc.fluid) { // maybe unpack it
                    this.block_text += '\nfluid: ' + desc.fluid;
                }
            }
        }

        // My XYZ
        const playerBlockPos = player.getBlockPos();
        const biome_id = player.getOverChunkBiomeId()
        const biome = biome_id > 0 ? world.chunkManager.biomes.byID.get(biome_id) : null;
        this.text += '\nXYZ: ' + playerBlockPos.x + ', ' + playerBlockPos.y + ', ' + playerBlockPos.z + ' / ' + this.FPS.speed + ' km/h / ' + (biome?.title ?? biome_id);

        if(!short_info) {
            const chunk = player.getOverChunk();
            if(chunk) {
                /*let biome = null;
                if(chunk.map) {
                    try {
                        biome = chunk.map.cells[playerBlockPos.x - chunk.coord.x][[playerBlockPos.z - chunk.coord.z]].biome.code;
                    } catch(e) {
                        //
                    }
                }*/
                this.text += '\nCHUNK: ' + chunk.addr.x + ', ' + chunk.addr.y + ', ' + chunk.addr.z; // + ' / ' + biome + '\n';
                this.text += '\nCLUSTER: ' + Math.floor(chunk.coord.x/world.info.generator.cluster_size.x) + ', ' + Math.floor(chunk.coord.z/world.info.generator.cluster_size.z) + '\n'; // + ' / ' + biome + '\n';
            }
        }

        // Players list
        if(draw_player_list) {
            this.text += '\nOnline:\n';
            let pcnt = 0;
            for(const player of world.players.values()) {
                this.text += player.username;
                if(player.itsMe()) {
                    this.text += ' (YOU)';
                } else {
                    if(player.distance) {
                        this.text += ` ... ${player.distance}m`;
                    }
                }
                this.text += '\n';
                if(++pcnt == ONLINE_MAX_VISIBLE_IN_F3) {
                    break;
                }
            }
            if(world.players.count > ONLINE_MAX_VISIBLE_IN_F3) {
                this.text += `+ ${world.players.count - ONLINE_MAX_VISIBLE_IN_F3} other(s)`;
            }
        }

        if(this.prevInfo == this.text) {
            return false;
        }
        this.prevInfo = this.text;
        return true;
    }

    // Draw game technical info
    drawInfo() {
        if(!this.draw_info || !this.text) {
            return;
        }
        // let text = 'FPS: ' + Math.round(this.FPS.fps) + ' / ' + Math.round(1000 / Qubatch.averageClockTimer.avg);
        this.drawText('info', this.text, 10 * this.zoom, 10 * this.zoom);
        //
        this.drawActiveQuest()
        //
        if (this.block_text) {
            let y = 10 * this.zoom
            let x = this.wm.w - 320 * this.zoom
            const quest_window = this.wm.hud_window.quests
            if(quest_window) {
                const tm = quest_window.getTextMetrics()
                x = this.wm.w - 20 * this.zoom - tm.width
                y = quest_window.y + tm.height + 20 * this.zoom
            }
            this.drawText('block_info', this.block_text, x, y, '#00000044')
        }
    }

    // Draw average FPS bar
    drawAverageFPS() {
        // TODO: pixi
        return
        const hist = Qubatch.averageClockTimer.history;
        const x = 20;
        const y = this.height - 20;
        const ctx = this.ctx;
        ctx.strokeStyle = '#00ff0044';
        ctx.beginPath(); // Start a new path
        for(let i = 0; i < hist.length; i++) {
            const h = hist[i];
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i, y - h * 10);
        }
        ctx.stroke(); // Render the path
        ctx.strokeStyle = '#000000';
    }

    // Draw active quest
    drawActiveQuest() {
        if(isMobileBrowser()) {
            return false;
        }
        const active_quest = Qubatch.hud.wm.getWindow('frmQuests').active;
        if(active_quest) {
            if(!active_quest.mt) {
                const quest_text = [active_quest.title];
                for(let action of active_quest.actions) {
                    let status = `🔲`;
                    if(action.ok) {
                        status = '✅';
                    }
                    switch(action.quest_action_type_id) {
                        case QuestActionType.CRAFT:
                        case QuestActionType.SET_BLOCK:
                        case QuestActionType.PICKUP: {
                            quest_text.push(`${status} ${action.description} ... ${action.value}/${action.cnt}`);
                            break;
                        }
                        /*
                        case QuestActionType.USE_ITEM:
                        case QuestActionType.GOTO_COORD: {
                            throw 'error_not_implemented';
                            break;
                        }*/
                        default: {
                            quest_text.push(`${status} ${action.description}`);
                            break;
                        }
                    }
                }
                quest_text.push('Нажми [TAB], чтобы увидеть подробности');
                active_quest.quest_text = quest_text.join('\n');
            }
            this.drawText('quests', active_quest.quest_text, this.wm.w - 20 * this.zoom, 20 * this.zoom, '#ffffff00', 'right');
        }
    }

    // Просто функция печати текста
    drawText(id : string, str : string, x : number, y : number, fillStyle ? : any, align : string = 'left') {
        let text_block = this.wm.hud_window[id]
        if(!text_block) {
            text_block = this.wm.hud_window[id] = new HUDLabel(x, y, this.wm.w - x, this.wm.h - y, `hud_${id}`)

            const fs = text_block.style.font._font_style
            fs.stroke = '#00000099'
            fs.strokeThickness = 4
            fs.lineHeight = 20
            // fs.dropShadow = true
            // fs.dropShadowAlpha = 1
            // fs.dropShadowBlur = 20
            // fs.dropShadowAngle = 0 // Math.PI / 6
            // fs.dropShadowColor = 0x0
            // fs.dropShadowDistance = 0

            switch(align) {
                case 'right': {
                    text_block.style.font.anchor.x = 1
                    text_block.style.font.align = 'left'
                    break
                }
            }
            text_block.style.font.color = '#ffffff'
            this.wm.hud_window.addChild(text_block)
        }

        //if(fillStyle) {
        //    text_block.style.background.color = fillStyle
        //}

        text_block.visible = true
        text_block. position.set(x, y)
        text_block.text = str

    }

}