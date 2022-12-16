import {WindowManager} from "../tools/gui/wm.js";
import {MainMenu} from "./window/index.js";
import {FPSCounter} from "./fps.js";
import {GeometryTerrain16} from "./geom/TerrainGeometry16.js";
import { isMobileBrowser, Vector } from "./helpers.js";
import {Resources} from "./resources.js";
import { DRAW_HUD_INFO_DEFAULT, ONLINE_MAX_VISIBLE_IN_F3 } from "./constant.js";
import { Lang } from "./lang.js";
import { Mesh_Effect } from "./mesh/effect.js";
import { Biomes } from "./terrain_generator/biome3/biomes.js";

// QuestActionType
export class QuestActionType {

    static PICKUP       = 1; // Добыть
    static CRAFT        = 2; // Скрафтить
    static SET_BLOCK    = 3; // Установить блок
    static USE_ITEM     = 4; // Использовать инструмент
    static GOTO_COORD   = 5; // Достигнуть координат

}

// Canvas used to draw HUD
export class HUD {

    constructor() {

        this.canvas                     = document.getElementById('qubatchHUD');
        this.ctx                        = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled  = false;
        this.active                     = true;
        this.draw_info                  = DRAW_HUD_INFO_DEFAULT;
        this.draw_block_info            = !isMobileBrowser();
        this.texture                    = null;
        this.buffer                     = null;
        this.width                      = 0;
        this.height                     = 0;
        this.text                       = null;
        this.block_text                 = null;
        this.items                      = [];
        this.prevInfo                   = null;
        this.prevDrawTime               = 0;
        this.strMeasures                = new Map();
        this.FPS                        = new FPSCounter();

        const that = this;

        // Splash screen (Loading...)
        this.splash = {
            loading:    true,
            image:      null,
            hud:        null,
            generate_terrain_time: 0,
            init: function(hud) {
                this.hud = hud;
            },
            draw: function() {
                let cl = 0;
                let nc = 45;
                let player_chunk_loaded = false;
                const player_chunk_addr = Qubatch.player?.chunkAddr;
                this.generate_terrain_time = 0;
                this.generate_terrain_count = 0;
                // const chunk_render_dist = Qubatch.player?.player?.state?.chunk_render_dist || 0;
                if(Qubatch.world && Qubatch.world.chunkManager) {
                    for(let chunk of Qubatch.world.chunkManager.chunks) {
                        if(chunk.inited) {
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
                this.loading = cl < nc || !player_chunk_loaded;
                if(!this.loading) {
                    return false;
                }
                let w = this.hud.width;
                let h = this.hud.height;
                let ctx = this.hud.ctx;
                ctx.save();
                if(this.image) {
                    /*for(let x = 0; x < w; x += this.image.width) {
                        for(let y = 0; y < h; y += this.image.height) {
                            ctx.drawImage(this.image, x, y);
                        }
                    }*/
                } else {
                    // Create gradient
                    var grd = ctx.createLinearGradient(0, 0, 0, h);
                    grd.addColorStop(0, '#1c1149');
                    grd.addColorStop(0.5365, '#322d6f');
                    grd.addColorStop(1, '#66408d');
                    // Fill with gradient
                    ctx.fillStyle = grd;
                    ctx.fillRect(0, 0, w, h);
                }
                //
                const texts = [];
                if(Resources.progress && Resources.progress.percent < 100) {
                    texts.push('LOADING RESOURCES ... ' + Math.round(Resources.progress.percent) + '%');
                } else if(cl == 0) {
                    texts.push(Lang.loading_game_connecting);
                } else {
                    texts.push(Lang.loading_game_generate_planet + ' ' + Math.round(Math.min(cl / nc * 100, 100 - (player_chunk_loaded ? 0 : 1))) + '%');
                }
                texts.push(Lang[isMobileBrowser() ? 'please_rotate_to_landscape' : 'press_f11_to_fullscreen']);
                //
                let x = w / 2;
                let y = h / 2;
                let padding = 15;
                /// draw text from top - makes life easier at the moment
                ctx.textBaseline = 'top';
                ctx.font = Math.round(18 * UI_ZOOM) + 'px ' + UI_FONT;
                //
                that.drawKbHelp(ctx, w, h, padding);
                //
                for(let i = 0; i < texts.length; i++) {
                    const txt = texts[i];
                    // Measure text
                    if(!this.prevSplashTextMeasure || this.prevSplashTextMeasure.text != txt) {
                        this.prevSplashTextMeasure = {
                            text: txt,
                            measure: ctx.measureText(txt)
                        };
                    }
                    // get width of text
                    let mt = this.prevSplashTextMeasure.measure;
                    let width = mt.width;
                    let height = mt.actualBoundingBoxDescent;
                    // color for background
                    ctx.fillStyle = 'rgba(255, 255, 255, .25)';
                    // draw background rect assuming height of font
                    ctx.fillRect(x - width / 2 - padding, y - height / 2 - padding, width + padding * 2, height + padding * 2);
                    // text color
                    ctx.fillStyle = '#333';
                    // draw text on top
                    ctx.fillText(txt, x - width / 2 + 2, y - height / 2 + 2);
                    // text color
                    ctx.fillStyle = '#fff';
                    // draw text on top
                    ctx.fillText(txt, x - width / 2, y - height / 2);
                    y += height * 3;
                }
                // restore original state
                ctx.restore();
                return true;
            }
        };
        this.splash.init(this);

        // Green frame
        this.add({
            drawHUD: function(that) {
                that.ctx.fillStyle      = '#ffffff';
                that.ctx.strokeStyle    = '#00ff00';
                that.ctx.lineCap        = 'round';
                that.ctx.lineWidth      = 1;
            }
        });

        // Init Window Manager
        const wm = this.wm = new WindowManager(this.canvas, this.ctx, 0, 0, this.canvas.width, this.canvas.height);
        wm.style.background.color       = '#00000000';
        wm.style.border.hidden          = true;
        wm.pointer.visible              = false;

        // Main menu
        this.frmMainMenu = new MainMenu(10, 10, 352, 332, 'frmMainMenu', null, null, this)
        wm.add(this.frmMainMenu);
    }

    isDrawingBlockInfo() {
        return this.active && this.draw_info && this.draw_block_info;
    }

    //
    drawKbHelp(ctx, w, h, padding) {
        if(!this.kb_tips) {
            this.kb_tips = {
                measures: {},
                list: [
                    // Lang.lbl_commands,
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
            };
            this.kb_tips.row_height = 0;
            this.kb_tips.max_width = 0;
            this.kb_tips.max_key_width = 0;
            for(let item of this.kb_tips.list) {
                let keym = ctx.measureText(item.key);
                let tipm = ctx.measureText(item.tip);
                if(keym.width > this.kb_tips.max_width) this.kb_tips.max_width = keym.width;
                if(keym.actualBoundingBoxDescent > this.kb_tips.row_height) this.kb_tips.row_height = keym.actualBoundingBoxDescent;
                if(tipm.width > this.kb_tips.max_width) this.kb_tips.max_width = tipm.width;
                if(tipm.actualBoundingBoxDescent > this.kb_tips.row_height) this.kb_tips.row_height = tipm.actualBoundingBoxDescent;
                if(keym.width > this.kb_tips.max_key_width) this.kb_tips.max_key_width = keym.width;
            }
        };
        let y = h - padding - this.kb_tips.row_height * this.kb_tips.list.length;
        for(let item of this.kb_tips.list) {
            ctx.fillStyle = '#ffffffbb';
            ctx.fillText(item.key + ': ' + item.tip, padding, y);
            ctx.fillStyle = '#ffc107';
            ctx.fillText(item.key, padding, y);
            y += this.kb_tips.row_height;
        }
    }

    get zoom() {
        return UI_ZOOM;
    }

    add(item, zIndex) {
        if(!this.items[zIndex]) {
            this.items[zIndex] = [];
        }
        this.items[zIndex].push({item: item});
    }

    refresh() {
        this.need_refresh = true;
        this.prepareText();
    }

    clear() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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

        this.frmMainMenu.parent.center(this.frmMainMenu);

        this.checkSize();

        // Check if need redraw
        const hasDrawContent = Qubatch.world && Qubatch.player && Qubatch.player.chat.hasDrawContent();
        if(!force && !this.need_refresh && !this.prepareText() && (performance.now() - this.prevDrawTime < 75) && !Qubatch.hud.wm.hasVisibleWindow() && !hasDrawContent) {
            return false;
        }
        this.need_refresh = false;
        this.prevDrawTime = performance.now();

        this.clear();

        // Draw splash screen...
        if(this.splash.draw()) {
            return;
        }

        // Set style
        this.ctx.fillStyle      = '#ff0000';
        this.ctx.font           = Math.round(18 * this.zoom) + 'px ' + UI_FONT;
        this.ctx.textAlign      = 'left';
        this.ctx.textBaseline   = 'top';

        if(this.isActive()) {
            // Draw game technical info
            this.drawInfo();
            // Draw HUD components
            for(let t of this.items) {
                for(let e of t) {
                    e.item.drawHUD(this);
                }
            }
        }

        // Draw windows
        this.ctx.restore();
        if(this.wm.hasVisibleWindow()) {
            this.wm.style.background.color = Qubatch.player.isAlive ? '#00000077' : '#ff330027';
            this.wm.draw(true);
        } else {
            this.wm.style.background.color = '#00000000';
            this.wm.draw(false);
        }

    }

    //
    checkSize() {

        const actual_width = this.ctx.canvas.width;
        const actual_height = this.ctx.canvas.height;

        if(Qubatch.hud.width != actual_width || Qubatch.hud.height != actual_height) {
            this.width  = actual_width;
            this.height = actual_height;
            this.ctx.font = Math.round(24 * this.zoom) + 'px ' + UI_FONT;
            Qubatch.hud.wm.resize(this.width, this.height);
            this.refresh();
        }
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
                this.text += ` ${mat.id} / ${this.mat_name}`;
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
                    '\nWorld pos.: ' + desc.worldPos.toString() +
                    '\nPos. in chunk: ' + desc.posInChunk.toString() +
                    '\nChunk addr.: ' + desc.chunkAddr.toString();
                if (desc.block.rotate) {
                    this.block_text += `\nrotate: ` + new Vector(desc.block.rotate);
                }
                if (desc.block.entity_id) {
                    this.block_text += '\nentiry_id: ' + desc.block.entity_id;
                }
                if (desc.block.power) {
                    this.block_text += '\npower: ' + desc.block.power;
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
        let biome_id = player.getOverChunkBiomeId()
        if(biome_id > 0) {
            if(!this.biomes) {
                globalThis.BLOCK = Qubatch.world.block_manager
                this.biomes = new Biomes(null);
            }
            biome_id = this.biomes.byID.get(biome_id).title
        }
        this.text += '\nXYZ: ' + playerBlockPos.x + ', ' + playerBlockPos.y + ', ' + playerBlockPos.z + ' / ' + this.FPS.speed + ' km/h / ' + biome_id;

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
                this.text += '\nCLUSTER: ' + Math.floor(chunk.coord.x/128) + ', ' + Math.floor(chunk.coord.z/128) + '\n'; // + ' / ' + biome + '\n';
            }
        }

        // Players list
        if(draw_player_list) {
            this.text += '\nOnline:\n';
            let pcnt = 0;
            for(let [id, p] of world.players.list) {
                this.text += '🙎‍♂️' + p.username;
                if(p.itsMe()) {
                    this.text += ' ⬅ YOU';
                } else {
                    if(p.distance) {
                        this.text += ` ... ${p.distance}m`;
                    }
                }
                this.text += '\n';
                if(++pcnt == ONLINE_MAX_VISIBLE_IN_F3) {
                    break;
                }
            }
            if(world.players.list.size > ONLINE_MAX_VISIBLE_IN_F3) {
                this.text += `+ ${world.players.list.size - ONLINE_MAX_VISIBLE_IN_F3} other(s)`;
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
        if (this.block_text) {
            const active_quest = Qubatch.hud.wm.getWindow('frmQuests').active;
            const y = active_quest?.mt ? active_quest.mt.height + 60 * this.zoom : 10 * this.zoom;
            const x = Math.max(this.width * 0.55, this.width - 400 * this.zoom);
            this.drawText('block_info', this.block_text, x, y);
        }
        //
        this.drawActiveQuest();
        //
        this.drawAverageFPS();
    }

    // Draw average FPS bar
    drawAverageFPS() {
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
                //
                active_quest.mt = {width: 0, height: 0, text: null};
                for(let str of quest_text) {
                    let mt = this.ctx.measureText(str);
                    active_quest.mt.height += mt.actualBoundingBoxDescent;
                    if(mt.width > active_quest.mt.width) {
                        active_quest.mt.width = mt.width;
                    }
                }
                active_quest.mt.quest_text = quest_text.join('\n');
            }
            this.ctx.textAlign = 'left';
            this.ctx.fillStyle = '#00000035';
            this.ctx.fillRect(this.width - active_quest.mt.width - 40 * this.zoom, 10 * this.zoom, active_quest.mt.width + 30 * this.zoom, active_quest.mt.height + 40 * this.zoom);
            // this.ctx.strokeStyle = '#ffffff88';
            this.ctx.strokeRect(this.width - active_quest.mt.width - 40 * this.zoom, 10 * this.zoom, active_quest.mt.width + 30 * this.zoom, active_quest.mt.height + 40 * this.zoom);
            this.drawText('quests', active_quest.mt.quest_text, this.width - active_quest.mt.width - 30 * this.zoom, 20 * this.zoom, '#ffffff00');
        }
    }

    // Просто функция печати текста
    drawText(id, str, x, y, fillStyle) {
        this.ctx.fillStyle = '#ffffff';
        str = str.split('\n');
        //
        let measures = this.strMeasures.get(id);
        if(!measures) measures = [];
        if(measures.length != str.length) {
            measures = new Array(str.length);
            this.strMeasures.set(id, measures);
        }
        for(let i = 0; i < str.length; i++) {
            if(!measures[i] || measures[i].text != str[i]) {
                measures[i] = {
                    text: str[i],
                    measure: this.ctx.measureText(str[i] + '|')
                };
            }
            this.drawTextBG(str[i], x, y + (26 * this.zoom) * i, measures[i].measure, fillStyle);
        }
    }

    // Напечатать текст с фоном
    drawTextBG(txt, x, y, mt, fillStyle) {
        // lets save current state as we make a lot of changes
        this.ctx.save();
        // draw text from top - makes life easier at the moment
        this.ctx.textBaseline = 'top';
        // get width of text
        const width = mt.width;
        const height = mt.actualBoundingBoxDescent;
        // color for background
        this.ctx.fillStyle = fillStyle || 'rgba(0, 0, 0, .35)';
        if(txt) {
            // draw background rect assuming height of font
            if(this.ctx.textAlign == 'right') {
                this.ctx.fillRect(x - width, y, width + 4 * this.zoom, height + 4 * this.zoom);
            } else {
                this.ctx.fillRect(x, y, width + 4 * this.zoom, height + 4 * this.zoom);
            }
        }
        // text color
        this.ctx.fillStyle = '#fff';
        // draw text on top
        this.ctx.fillText(txt, x + 2 * this.zoom, y + 2 * this.zoom);
        // restore original state
        this.ctx.restore();
    }

}