import {MainMenu} from "./window/index.js";
import {FPSCounter} from "./fps.js";
import {GeometryTerrain16} from "./geom/terrain_geometry_16.js";
import { isMobileBrowser, Vector } from "./helpers.js";
import {Resources} from "./resources.js";
import { DRAW_HUD_INFO_DEFAULT, HUD_CONNECTION_WARNING_INTERVAL, ONLINE_MAX_VISIBLE_IN_F3 } from "./constant.js";
import { Lang } from "./lang.js";
import { Mesh_Effect } from "./mesh/effect.js";
import type {GameClass} from "./game.js";
import { Label, Window, WindowManager } from "./ui/wm.js";
import { GradientGraphics } from "./ui/splash/gradient_graphics.js";
import type { Player } from "./player.js";
import type { Renderer } from "./render.js";
import type { ChunkManager } from "./chunk_manager.js";
import type { World } from "./world.js";
import { FLUID_LAVA_ID, FLUID_TYPE_MASK, FLUID_WATER_ID } from "./fluid/FluidConst.js";
import {HUD_Underlay} from "./window/hud/hud_underlay.js";
import { SplashMesh1 } from "./ui/splash/splash_mesh_1.js";

declare type ICompasMark = {
    angle: number,
    title: string,
    color?: string,
}

const compass_id = 'wndCompass'

const compas_marks : ICompasMark[] = [
    {
        'angle': 0,
        'title': 'N',
        // 'color': '#F56F6F'
    },
    {
        'angle': Math.PI / 2,
        'title': 'E'
    },
    {
        'angle': Math.PI,
        'title': 'S'
    },
    {
        'angle': (3 * Math.PI / 2),
        'title': 'W'
    }
]

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
    lbl_loading: Window

    constructor(wm, x, y, w, h) {
        super(x, y, w, h, 'hudwindow')
        this.x *= this.zoom
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom
        this.addChild(this.splash = GradientGraphics.createVertical('#1c1149', '#66408d', 512))
        // this.addChild(this.splash = new SplashMesh1());
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
            const game = Qubatch as GameClass
            const sinceLastPacket = performance.now() - game.world.server.lastPacketReceivedTime
            const serverQueueLag = game.world.serverQueueLag
            if (Math.max(sinceLastPacket, serverQueueLag) > HUD_CONNECTION_WARNING_INTERVAL) {
                this.noConnectionWarning.visible = true
                if(this.noConnectionWarning.w != width) {
                    this.noConnectionWarning.w = width
                }
                this.noConnectionWarning.text = sinceLastPacket > HUD_CONNECTION_WARNING_INTERVAL
                    ? Lang[`no_connection|${(sinceLastPacket * 0.001).toFixed(1)}`]
                    : Lang[`high_server_queue_lag|${(serverQueueLag * 0.001).toFixed(1)}`]
            }
        }
        if(this.lbl_loading.w != width || this.lbl_loading.h != height) {
            this.lbl_loading.w = width
            this.lbl_loading.h = height
            this.kb_tips.h = height
        }
        this.lbl_loading.visible = loading
        this.splash.visible = loading
        this.resize2(width, height, loading_parts)
    }

    resize2(width : number, height : number, loading_parts : any[]) {
        if(this.splash.width != width || this.splash.height != height) {
            this.splash.width = width
            this.splash.height = height
            this.progressbar.y = height - this.progressbar.h
        }
        let percent = 0
        loading_parts.map(item => percent += item.percent / loading_parts.length)
        this.progressbar.w = percent * width
    }

}

export class Splash {

    hud:                    HUD        = null
    hudwindow:              HUDWindow  = null
    underlay:               HUD_Underlay = null;
    qubatch:                GameClass  = null
    loading:                boolean    = true
    image:                  any        = null
    generate_terrain_time:  float      = 0
    loaded_chunks_count:    int        = 0
    generate_terrain_count: int        = 0

    constructor(hud : HUD, hudwindow : HUDWindow) {
        this.hud = hud
        this.hudwindow = hudwindow
        this.qubatch = Qubatch
    }

    draw() : boolean {

        const qubatch = this.qubatch
        const nc = 45

        let cl = 0
        let chunk_loaded_percent = 0

        if(qubatch.world?.chunkManager) {
            const cs = qubatch.world.chunkManager.chunks_state

            this.generate_terrain_time      = cs.total.one_chunk_generate_time
            this.loaded_chunks_count        = cs.stat.loaded
            this.generate_terrain_count     = cs.stat.applied_vertices

            cl = cs.stat.blocks_generated
            const player_chunk_loaded = qubatch.player?.getOverChunk()?.inited

            chunk_loaded_percent = cl / nc
            this.loading = (chunk_loaded_percent < 1) || !player_chunk_loaded;
        }

        const loading_parts = [
            {code: 'chunks', percent: Math.min(chunk_loaded_percent, 1)},
            {code: 'resources', percent: (Resources.progress?.percent ?? 0) / 100}
        ]

        // Splash background
        this.hudwindow.update(this.hud.width, this.hud.height, this.loading, loading_parts)

        if(!this.loading) {
            return false
        }

        return true
    }

}

// Canvas used to draw HUD
export class HUD {
    [key: string]: any;

    FPS = new FPSCounter()
    active:                 boolean = true
    draw_info:              boolean = DRAW_HUD_INFO_DEFAULT
    draw_block_info:        boolean = !isMobileBrowser()
    wm:                     WindowManager
    text:                   string | null = null
    need_refresh?:          boolean

    constructor(canvas) {

        this.canvas = canvas

        this.texture                    = null
        this.buffer                     = null
        this.block_text                 = null
        this.items                      = []
        this.prevInfo                   = null
        this.prevDrawTime               = 0
        this.strMeasures                = new Map()

        // Init Window Manager
        const wm = this.wm = new WindowManager(this.canvas, 0, 0, this.canvas.width, this.canvas.height)

        this.underlay = new HUD_Underlay();
        wm.untypedParent.addChildAt(this.underlay, 0);
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
        this.splash = new Splash(this, hudwindow)

    }

    get width() : float {
        return this.canvas.width
    }

    get height() : float {
        return this.canvas.height
    }

    isDrawingBlockInfo() {
        return this.active && this.draw_info && this.draw_block_info;
    }

    get zoom() : float {
        return UI_ZOOM * Qubatch.settings.window_size / 100
    }

    add(item, zIndex : int) {
        if(!this.items[zIndex]) {
            this.items[zIndex] = [];
        }
        this.items[zIndex].push({item: item});
    }

    refresh() : void {
        this.need_refresh = true
        this.prepareText()
    }

    //
    toggleActive() : void {
        this.active = !this.active;
        this.refresh();
    }

    //
    isActive(): boolean {
        return this.active
    }

    draw(force : boolean = false) {

        if(!this.isActive()) {
            return
        }

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
            if(c instanceof Label) {
                c.visible = false
            }
        }

        for(const item of this.items) {
            for(const e of item) {
                e.item.drawHUD(this)
            }
        }

        // Draw game technical info
        this.drawInfo()
        this.drawAverageFPS()
        this.drawCompas(this.wm.w / 2, 20 * this.zoom, 1850/4 * this.zoom, 80/4 * this.zoom)

        // Draw windows
        if(this.wm.hasVisibleWindow()) {
            this.wm.style.background.color = Qubatch.player.isAlive ? '#00000077' : '#ff330027';
        } else {
            this.wm.style.background.color = '#00000000';
        }

        this.wm.draw()

    }

    /**
     * @param width In pixels
     * @param height In pixels
     */
    resize(width : float, height : float) {

        // const dpr = window.devicePixelRatio
        // width /= dpr
        // height /= dpr
        this.wm.w = width
        this.wm.h = height

        this.wm.hud_window.w = width
        this.wm.hud_window.h = height

        this.underlay.resize(this.wm.pixiRender.screen, this.zoom)

        this.refresh()

    }

    toggleInfo() {
        this.draw_info = !this.draw_info;
        this.refresh();
    }

    //
    prepareText() : boolean {

        // If render not inited
        if(!Qubatch.render || !Qubatch.world || !Qubatch.player) {
            return false;
        }

        const game              : GameClass     = Qubatch
        const world             : World         = Qubatch.world
        const player            : Player        = Qubatch.player
        const render            : Renderer      = Qubatch.render
        const cm                : ChunkManager  = world.chunkManager
        const short_info        : boolean       = isMobileBrowser()
        const draw_player_list  : boolean       = !short_info
        const draw_tech_info    : boolean       = true
        const splash            : Splash        = this.splash

        this.text = '';

        if (!this.active) { // если HUD не виден - не вычисялть этот огромный текст
            return false
        }

        if(render.renderBackend.kind != 'webgl') {
            this.text = 'Render: ' + render.renderBackend.kind + '\n';
        }

        // Video card info
        const vci = render.getVideoCardInfo();
        if(!vci.error) {
            this.text += 'Renderer: ' + vci.renderer + '\n';
        }

        // FPS
        this.text += `FPS: ${Math.round(this.FPS.fps)} / worst: ${Math.round(this.FPS.worstFrameFps)}` +
            ` / avg. main loop: ${this.FPS.averageClockTimerAvg?.toFixed(2)} ms`
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
                // it seems this condition is never true (e.g., it's not true for the water bucket):
                if((mat as any).is_fluid) {
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
            this.text += `\nLAG: ${Math.round(world.latency)}ms / ${world.serverQueueLag}ms`;

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
            const chunk_size_xz = world.info.tech_info.chunk_size.x
            this.text += `\nChunks drawn: ${Math.round(cm.rendered_chunks.fact)} / ${cm.rendered_chunks.total} (${player.state.chunk_render_dist}x${chunk_size_xz}=${player.state.chunk_render_dist*chunk_size_xz}) ${splash?.generate_terrain_time}`

            // Quads and Lightmap
            let quads_length_total = cm.vertices_length_total;
            this.text += '\nQuads: ' + Math.round(render.renderBackend.stat.drawquads) + ' / ' + quads_length_total // .toLocaleString(undefined, {minimumFractionDigits: 0}) +
                + ' / ' + Math.round(quads_length_total * GeometryTerrain16.strideFloats * 4 / 1024 / 1024) + 'Mb'
                + ' / ' + Math.round( cm.renderList.bufferSizeBytes / 1024 / 1024) + 'Mb';
            this.text += '\nLightmap: ' + Math.round(cm.renderList.lightmap_count)
                + ' / ' + Math.round(cm.renderList.lightmap_bytes / 1024 / 1024) + 'Mb';

            // Draw tech info
            if(draw_tech_info) {
                this.text += '\nPackets: ' + Qubatch.world.server.stat.out_packets.total + '/' + Qubatch.world.server.stat.in_packets.total; // + '(' + Qubatch.world.server.stat.in_packets.physical + ')';
                if(render) {
                    this.text += '\nParticles: ' + Mesh_Effect.current_count;
                    if(render.draw_mobs_stat) {
                        this.text += `\nDraw mobs: ${render.draw_mobs_stat.count} ... ${Math.round(render.draw_mobs_stat.time * 100) / 100}ms`
                    }
                    this.text += '\nDrawcalls: ' + render.renderBackend.stat.drawcalls;
                    if (render.renderBackend.stat.multidrawcalls) {
                        this.text += ' + ' + render.renderBackend.stat.multidrawcalls + '(multi)';
                    }
                }
            }

            const desc = Qubatch.player.pickAt.targetDescription;
            const {relativePosToFlatIndexInChunk, relativePosToChunkIndex} = world.chunkManager.grid.math
            this.block_text = null;
            if (this.draw_block_info && desc) {
                this.block_text = 'Targeted block Id: ' + desc.block.id +
                    '\nName: ' + desc.material.name +
                    '\nStyle: ' + desc.material.style_name +
                    '\nWorld pos.: ' + desc.worldPos.toString() +
                    `\nPos. in chunk: ${desc.posInChunk.toString()}, flat=${relativePosToFlatIndexInChunk(desc.posInChunk)},\n               ind=${relativePosToChunkIndex(desc.posInChunk)}` +
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
                if (desc.material.is_solid) {
                    this.block_text += ' is_solid ';
                }
                if (desc.caveLight !== undefined) {
                    this.block_text += `\nCave light: ${desc.caveLight}`
                    this.block_text += `\nDay light: ${desc.dayLight}`
                }
                const ed = desc.block.extra_data
                if (ed) {
                    this.block_text += '\nextra_data: ' + JSON.stringify(ed, null, 2)
                }
                if (desc.fluid) { // maybe unpack it
                    this.block_text += '\nFluid: ' + desc.fluid;
                    if ((desc.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID) {
                        this.block_text += ' water';
                    }
                    if ((desc.fluid & FLUID_TYPE_MASK) === FLUID_LAVA_ID) {
                        this.block_text += ' lava';
                    }
                }
            }

            if (this.draw_block_info) {
                this.block_text += '\n\nPlayer info: '
                const state = player.controlManager.prismarine.player_state
                this.block_text += '\nvel: ' + state.vel
                this.block_text += '\nGround: ' + state.onGround
                this.block_text += '\nisCollidedHorizontally: ' + state.isCollidedHorizontally
                this.block_text += '\nisCollidedVertically: ' + state.isCollidedVertically
                this.block_text += '\nsubmergedHeight: ' + state.submergedHeight
                this.block_text += '\nLava: ' + state.isInLava + ' Water: ' + state.isInWater + ' Liquid: ' + state.isInLiquid
            }
        }

        // My XYZ
        const playerBlockPos = player.getBlockPos();
        const biome_id = player.getOverChunkBiomeId()
        const biome = biome_id > 0 ? world.chunkManager.biomes.byID.get(biome_id) : null;
        this.text += '\nSEED: ' + Qubatch.world.info.seed
        this.text += '\nXYZ: ' + playerBlockPos.x + ', ' + playerBlockPos.y + ', ' + playerBlockPos.z + ' / ' + this.FPS.speed + ' km/h'
        if (player.game_mode.isSpectator()) {
            this.text += ' (x'+ player.controlManager.spectator.speedMultiplier.toFixed(2) + ')'
        }
        this.text += ' / ' + (biome?.title ?? biome_id);

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
            return false
        }
        this.prevInfo = this.text
        return true
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
        const active_quest = Qubatch.hud.wm.getWindow('frmInGameMain').getTab('frmQuests').form.active;
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
        text_block.visible = true
        text_block. position.set(x, y)
        text_block.text = str
    }

    drawCompas(x : float, y : float, w : float, h : float) {
        if (!Qubatch.settings.show_compass) {
            return
        }
        const rot = Qubatch.player.rotate.z
        const hud_window = this.wm.hud_window
        let compas : Label = hud_window[compass_id]
        if (!compas) {
            const hud_atlas = Resources.atlas.get('hud')
            compas = hud_window[compass_id] = new Label(x - w / 2, y, w + 20 * this.zoom, h, compass_id, '', '|')
            compas.setBackground(hud_atlas.getSpriteFromMap('compas_back'))
            compas.style.font.color = '#a4e8f1'
            compas.style.textAlign.horizontal = 'center'
            hud_window.addChild(compas)
        }
        compas.visible = true
        compas.x = x - w / 2
        for (const mark of compas_marks) {
            let angle = rot - mark.angle
            if (angle < -Math.PI || angle > Math.PI) {
                angle = -angle
            }
            if (angle < -3 * Math.PI / 2) {
                angle = -2 * Math.PI - angle
            }
            let alpha = Math.round((1.37 - Math.abs(Math.atan(angle))) * 190).toString(16)
            if (alpha.length == 1) {
                alpha = '0' + alpha
            }
            const id = 'compass_' + mark.title
            let mark_label = hud_window[id]
            if (!mark_label) {
                mark_label = hud_window[id] = new Label((x - w / 2), y, 20 * this.zoom, 20 * this.zoom, id, mark.title, mark.title)
                mark_label.style.font.size = 12
                hud_window.addChild(mark_label)
                mark_label.style.textAlign.horizontal = 'center'
            }
            mark_label.visible = true
            mark_label.x = x  -  w * Math.atan(angle) / 2.8
            if (mark?.color) {
                mark_label.style.font.color = mark.color + '' + alpha
            } else {
                mark_label.style.font.color = '#a4e8f1' + '' + alpha
            }
        }
    }

}