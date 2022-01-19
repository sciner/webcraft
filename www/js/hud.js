import {WindowManager} from "../tools/gui/wm.js";
import {MainMenu} from "./window/index.js";
import {FPSCounter} from "./fps.js";
import GeometryTerrain from "./geometry_terrain.js";
import {Helpers, Vector} from './helpers.js';
import {Resources} from "./resources.js";

export class HUD {

    zoom = UI_ZOOM;

    constructor(width, height) {

        // Create canvas used to draw HUD
        let canvas                      = this.canvas = document.createElement('canvas');
        canvas.id                       = 'cnvHUD';
        canvas.width                    = width;
        canvas.height                   = height;
        canvas.style.position           = 'fixed';
        // canvas.style.background         = 'radial-gradient(circle at 50% 50%, rgba(0,0,0, 0) 50%, rgb(0 0 0 / 30%) 100%)';
        canvas.style.zIndex             = 0;
        canvas.style.pointerEvents      = 'none';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        this.ctx                        = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled  = false;
        document.body.appendChild(this.canvas);
        this.active                     = true;
        this.draw_info                  = true;

        this.texture                    = null;
        this.buffer                     = null;
        this.width                      = width;
        this.height                     = height;
        this.text                       = null;
        this.items                      = [];
        this.prevInfo                   = null;
        this.prevDrawTime               = 0;

        this.FPS                        = new FPSCounter();

        // Vignette
        // this.makeVignette(width, height);

        // Splash screen (Loading...)
        this.splash = {
            loading:    true,
            image:      null,
            hud:        null,
            init: function(hud) {
                this.hud = hud;
            },
            draw: function() {
                let cl = 0;
                let nc = 45;
                if(Game.world && Game.world.chunkManager) {
                    for(let chunk of Game.world.chunkManager.chunks) {
                        if(chunk.inited) {
                            cl++;
                        }
                    }
                }
                this.loading = cl < nc;
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
                let txt = '';
                if(Resources.progress && Resources.progress.percent < 100) {
                    txt = 'LOADING RESOURCES ... ' + Math.round(Resources.progress.percent) + '%';
                } else if(cl == 0) {
                    txt = 'CONNECTING TO SERVER...';
                } else {
                    txt = 'GENERATE PLANET ... ' + Math.round(cl / nc * 100) + '%';
                }
                //
                let x = w / 2;
                let y = h / 2;
                let padding = 15;
                /// draw text from top - makes life easier at the moment
                ctx.textBaseline = 'top';
                // get width of text
                let mt = ctx.measureText(txt);
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
        let wm = this.wm = new WindowManager(this.canvas, this.ctx, 0, 0, this.canvas.width, this.canvas.height);
        wm.style.background.color       = '#00000000';
        wm.style.border.hidden          = true;
        wm.pointer.visible              = false;

        // Main menu
        this.frmMainMenu = new MainMenu(10, 10, 352, 332, 'frmMainMenu', null, null, this)
        wm.add(this.frmMainMenu);
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

    /*makeVignette(width, height) {
        this.vignette = this.ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
        this.vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
        this.vignette.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    }*/

    drawVignette() {
        // this.ctx.fillStyle = this.vignette;
        // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(force) {

        this.frmMainMenu.parent.center(this.frmMainMenu);

        let new_width = null;
        let new_height = null;

        if(Game.render.canvas.width > Game.render.canvas.height) {
            new_width = document.body.clientWidth;
            new_height = document.body.clientHeight;
        } else {
            new_height =  (332 * 3.5);
            new_width = (new_height * (Game.render.canvas.width / Game.render.canvas.height));
        }

        new_width = Math.round(new_width * window.devicePixelRatio);
        new_height = Math.round(new_height * window.devicePixelRatio);

        if(Game.hud.width != new_width || Game.hud.height != new_height) {
            this.width  = this.ctx.canvas.width   = new_width;
            this.height = this.ctx.canvas.height  = new_height;
            this.ctx.font = Math.round(24 * this.zoom) + 'px Ubuntu';
            Game.hud.wm.resize(this.width, this.height);
            this.refresh();
            // Vignette
            // this.makeVignette(this.width, this.height);
        }

        // Make info for draw
        let hasDrawContent = Game.world && Game.player && Game.player.chat.hasDrawContent();
        if(!force && !this.need_refresh && !this.prepareText() && (performance.now() - this.prevDrawTime < 1000) && !Game.hud.wm.hasVisibleWindow() && !hasDrawContent) {
            return false;
        }
        this.need_refresh = false;
        this.prevDrawTime = performance.now();

        this.clear();

        // Draw vignette
        // this.drawVignette();

        // Draw splash screen...
        if(this.splash.draw()) {
            return;
        }

        // Set style
        this.ctx.fillStyle      = '#ff0000';
        this.ctx.font           = Math.round(20 * this.zoom) + 'px Ubuntu';
        this.ctx.textAlign      = 'left';
        this.ctx.textBaseline   = 'top';

        this.ctx.save();

        if(this.isActive()) {
            // Draw game technical info
            this.drawInfo();
            // Draw HUD components
            for(let t of this.items) {
                for(let e of t) {
                    this.ctx.restore();
                    e.item.drawHUD(this);
                }
            }
        }

        // Draw windows
        this.ctx.restore();
        if(this.wm.hasVisibleWindow()) {
            this.wm.style.background.color = '#00000077';
            this.wm.draw(true);
        } else {
            this.wm.style.background.color = '#00000000';
            this.wm.draw(false);
        }

    }

    toggleInfo() {
        this.draw_info = !this.draw_info;
        this.refresh();
    }

    //
    prepareText() {
        this.text = '';
        // If render inited
        if(!Game.render || !Game.world || !Game.player) {
            return;
        }
        let world = Game.world;
        let player = Game.player;
        this.text = 'Render: ' + Game.render.renderBackend.kind + '\n';
        let vci = Game.render.getVideoCardInfo();
        if(!vci.error) {
            this.text += '\nRenderer: ' + vci.renderer;
        }
        this.text += 'FPS: ' + Math.round(this.FPS.fps) + ' / ' + (Math.round(1000 / this.FPS.avg * 100) / 100) + ' ms';
        this.text += '\nMAT: ';
        let mat = player.currentInventoryItem;
        if(mat) {
            this.text += ' ' + mat.id + ' / ' + mat.name;
            if(mat.fluid) {
                this.text += ' ' + '(FLUID!!!)';
            }
        } else {
            this.text += 'NULL';
        }
        this.text += '\nGame mode: ' + player.game_mode.getCurrent().title;
        if(player.world.server.ping_value) {
            this.text += '\nPING: ' + Math.round(player.world.server.ping_value) + ' ms';
        }

        this.text += '\nLAG: ' + Math.round(player.world.latency) + 'ms';

        let time = world.getTime();
        if(time) {
            this.text += '\nDay: ' + time.day + ', Time: ' + time.string;
        }
        // If render inited
        if(Game.render) {
            // Chunks inited
            this.text += '\nChunks drawed: ' + Math.round(world.chunkManager.rendered_chunks.fact) + ' / ' + world.chunkManager.rendered_chunks.total + ' (' + player.state.chunk_render_dist + ')';
            //
            let quads_length_total = world.chunkManager.vertices_length_total;
            this.text += '\nQuads: ' + Math.round(Game.render.renderBackend.stat.drawquads) + ' / ' + quads_length_total // .toLocaleString(undefined, {minimumFractionDigits: 0}) +
                + ' / ' + Math.round(quads_length_total * GeometryTerrain.strideFloats * 4 / 1024 / 1024) + 'Mb';
            this.text += '\nLightmap: ' + Math.round(world.chunkManager.lightmap_count)
                + ' / ' + Math.round(world.chunkManager.lightmap_bytes / 1024 / 1024) + 'Mb';
            //
            this.text += '\nDrawcalls: ' + Game.render.renderBackend.stat.drawcalls;
        }
        // Console =)
        let playerBlockPos = player.getBlockPos();
        let chunk = player.overChunk;
        this.text += '\nXYZ: ' + playerBlockPos.x + ', ' + playerBlockPos.y + ', ' + playerBlockPos.z + ' / ' + this.FPS.speed + ' km/h';
        if(chunk) {
            /*let biome = null;
            if(chunk.map) {
                try {
                    biome = chunk.map.cells[playerBlockPos.x - chunk.coord.x][[playerBlockPos.z - chunk.coord.z]].biome.code;
                } catch(e) {
                    //
                }
            }*/
            this.text += '\nCHUNK: ' + chunk.addr.x + ', ' + chunk.addr.y + ', ' + chunk.addr.z + '\n'; // + ' / ' + biome + '\n';
        }
        // Players list
        this.text += '\nOnline:\n';
        for(let [id, p] of world.players.list) {
            if(id == 'itsme') {
                continue;
            }
            this.text += '🙎‍♂️' + p.username;
            if(p.itsMe()) {
                this.text += ' <- YOU';
            } else {
                this.text += ' ... ' + Math.floor(Helpers.distance(player.pos, p._pos)) + 'm';
            }
            this.text += '\n';
        }
        if(this.prevInfo == this.text) {
            return false;
        }
        this.prevInfo = this.text;
        return true;
    }

    // Draw game technical info
    drawInfo() {
        if(!this.draw_info) {
            return;
        }
        // let text = 'FPS: ' + Math.round(this.FPS.fps) + ' / ' + Math.round(1000 / Game.averageClockTimer.avg);
        this.drawText(this.text, 10 * this.zoom, 10 * this.zoom);
    }

    // Просто функция печати текста
    drawText(str, x, y) {
        this.ctx.fillStyle = '#ffffff';
        str = str.split('\n');
        for(let i in str) {
            this.drawTextBG(str[i], x, y + (26 * this.zoom) * i);
        }
    }

    // Напечатать текст с фоном
    drawTextBG(txt, x, y) {
        /// lets save current state as we make a lot of changes
        this.ctx.save();
        /// draw text from top - makes life easier at the moment
        this.ctx.textBaseline = 'top';
        // get width of text
        let mt = this.ctx.measureText(txt+'|');
        let width = mt.width;
        let height = mt.actualBoundingBoxDescent;
        // color for background
        this.ctx.fillStyle = 'rgba(0, 0, 0, .35)';
        if(txt) {
            // draw background rect assuming height of font
            this.ctx.fillRect(x, y, width + 4 * this.zoom, height + 4 * this.zoom);
        }
        // text color
        this.ctx.fillStyle = '#fff';
        // draw text on top
        this.ctx.fillText(txt, x + 2 * this.zoom, y + 2 * this.zoom);
        // restore original state
        this.ctx.restore();
    }

}