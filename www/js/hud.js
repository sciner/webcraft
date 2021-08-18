import {WindowManager} from "../tools/gui/wm.js";
import {MainMenu} from "./window/index.js";
import {fps} from "./fps.js";
import GeometryTerrain from "./geometry_terrain.js";
import {Helpers} from './helpers.js';
import { Game } from "./game.js";

export default class HUD {

    constructor(width, height) {
        // Create canvas used to draw HUD
        let canvas                      = this.canvas = document.createElement('canvas');
        canvas.id                       = 'cnvHUD';
        canvas.width                    = width;
        canvas.height                   = height;
        // canvas.style.display            = 'none';
        canvas.style.position           = 'fixed';
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

        // Splash screen (Loading...)
        this.splash = {
            loading:    true,
            image:      null,
            hud:        null,
            init: function(hud) {
                let that = this;
                that.hud = hud;
                let image = new Image();
                image.onload = function() {
                    that.image = this;
                }
                image.src = '../media/background.png';
            },
            draw: function() {
                let cl = 0;
                for(let key of Object.keys(Game.world.chunkManager.chunks)) {
                    let chunk = Game.world.chunkManager.chunks[key];
                    if(chunk.inited) {
                        cl++;
                    }
                }
                let nc = 0; // #3dchunk (для 2D чанков было 45)
                this.loading = cl < nc;
                if(!this.loading) {
                    return false;
                }
                let w = this.hud.width;
                let h = this.hud.height;
                let ctx = this.hud.ctx;
                ctx.save();
                if(this.image) {
                    for(let x = 0; x < w; x += this.image.width) {
                        for(let y = 0; y < h; y += this.image.height) {
                            ctx.drawImage(this.image, x, y);
                        }
                    }
                } else {
                    // color for background
                    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                    // draw background rect assuming height of font
                    ctx.fillRect(0, 0, w, h);
                }
                //
                let txt = 'LOADING ... ' + Math.round(cl / nc * 100) + '%';
                //
                let x = w / 2;
                let y = h / 2 + 50;
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
    }
    
    //
    isActive() {
        return this.active;
    }
    
    draw() {

        this.frmMainMenu.parent.center(this.frmMainMenu);

        let new_width = null;
        let new_height = null;
    
        if(Game.canvas.width > Game.canvas.height) {
            new_width =  Math.round(352 * 4.5);
            new_height = Math.round(new_width * (Game.canvas.height / Game.canvas.width));
            new_width = document.body.clientWidth;
            new_height = document.body.clientHeight;
        } else {
            new_height =  Math.round(332 * 3.5);
            new_width = Math.round(new_height * (Game.canvas.width / Game.canvas.height));
        }
    
        if(Game.hud.width != new_width || Game.hud.height != new_height) {
            this.width  = this.ctx.canvas.width   = new_width;
            this.height = this.ctx.canvas.height  = new_height;
            this.ctx.font = '24px Minecraftia';
            Game.hud.wm.resize(this.width, this.height);
        }
    
        // Make info for draw
        if(!this.prepareText() && (performance.now() - this.prevDrawTime < 1000) && Game.hud.wm.getVisibleWindows().length == 0 && !Game.world.localPlayer.chat.hasDrawContent()) {
            return false;
        }
        this.prevDrawTime = performance.now();
    
        this.clear();
    
        // Draw splash screen...
        if(this.splash.draw()) {
            return;
        }
    
        // Set style
        this.ctx.fillStyle      = '#ff0000';
        this.ctx.font           = '20px Minecraftia';
        this.ctx.textAlign      = 'left';
        this.ctx.textBaseline   = 'top';
    
        this.ctx.save();
    
        if(this.isActive()) {
    
            // Draw game technical info
            this.drawInfo();
    
            // Crosshair
            for(let cs of [{width: '2', color: 'black'}, {width: '1', color: 'white'}]) {
            this.ctx.beginPath();
                let x = this.ctx.canvas.width / 2;
                let y = this.ctx.canvas.height / 2;
                x = Math.floor(x) + 0.5;
                y = Math.floor(y) + 0.5;
                this.ctx.lineWidth = cs.width;
                this.ctx.moveTo(x, y - 10);
                this.ctx.lineTo(x, y + 10);
                this.ctx.moveTo(x - 10,  y);
                this.ctx.lineTo(x + 10,  y);
                this.ctx.strokeStyle = cs.color;
            this.ctx.stroke();
            }
    
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
        if(this.wm.getVisibleWindows().length > 0) {
            this.wm.style.background.color = '#00000077';
            this.wm.draw(true);
        } else {
            this.wm.style.background.color = '#00000000';
            this.wm.draw(false);
        }
    
    }
    
    //
    prepareText() {
        this.text = 'Render: ' + Game.render.renderBackend.kind + '\n';
        this.text += 'FPS: ' + Math.round(fps.fps) + ' / ' + (Math.round(1000 / fps.avg * 100) / 100) + ' ms';
        let vci = Game.render.getVideoCardInfo();
        if(!vci.error) {
            this.text += '\nRenderer: ' + vci.renderer;
        }
        this.text += '\nMAT: ';
        let mat = Game.player.buildMaterial;
        if(mat) {
            this.text += ' ' + mat.id + ' / ' + mat.name;
            if(mat.fluid) {
                this.text += ' ' + '(FLUID!!!)';
            }
        } else {
            this.text += 'NULL';
        }
        if(performance.now() - Game.last_saved_time < 3000) {
            this.text += '\nSaved ... OK';
        }
        // text += '\nUsername: ' + Game.username;
        if(Game.world.server.ping_value) {
            this.text += '\nPING: ' + Math.round(Game.world.server.ping_value) + ' ms';
        }
        // this.text += '\nYAW: ' + Math.round(Game.world.rotateDegree.z);
        // Chunks inited
        this.text += '\nChunks inited: ' + Math.round(Game.world.chunkManager.rendered_chunks.fact) + ' / ' + Game.world.chunkManager.rendered_chunks.total + ' (' + Game.world.chunkManager.CHUNK_RENDER_DIST + ')';
        //
        let quads_length_total = Game.world.chunkManager.vertices_length_total;
        this.text += '\nQuads: ' + quads_length_total + // .toLocaleString(undefined, {minimumFractionDigits: 0}) +
            ' / ' + Math.round(quads_length_total * GeometryTerrain.strideFloats * 4 / 1024 / 1024) + 'Mb';
        //
        // this.text += '\nChunks update: ' + (Game.world.chunkManager.update_chunks ? 'ON' : 'OFF');
        // Console =)
        let playerBlockPos = Game.world.localPlayer.getBlockPos();
        let chunk = Game.world.localPlayer.overChunk;
        this.text += '\nXYZ: ' + playerBlockPos.x + ', ' + playerBlockPos.y + ', ' + playerBlockPos.z;
        if(chunk) {
            let biome = null;
            if(chunk.map) {
                try {
                    biome = chunk.map.cells[playerBlockPos.x - chunk.coord.x][[playerBlockPos.z - chunk.coord.z]].biome.code;
                } catch(e) {
                    //
                }
            }
            this.text += '\nCHUNK: ' + chunk.addr.x + ', ' + chunk.addr.y + ', ' + chunk.addr.z + ' / ' + biome + '\n';
        }
        // Players list
        this.text += '\nOnline:\n';
        for(let id of Object.keys(Game.world.players)) {
            let player = Game.world.players[id];
            if(id == 'itsme') {
                continue;
            }
            this.text += '🙎‍♂️' + player.nick;
            if(player.itsme) {
                this.text += ' <- YOU';
            } else {
                this.text += ' ... ' + Math.floor(Helpers.distance(player.pos, Game.world.localPlayer.pos)) + 'm';
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
        // let text = 'FPS: ' + Math.round(fps.fps) + ' / ' + Math.round(1000 / Game.loopTime.avg);
        this.drawText(this.text, 10, 10);
    }
    
    // Просто функция печати текста
    drawText(str, x, y) {
        this.ctx.fillStyle = '#ffffff';
        str = str.split('\n');
        for(let i in str) {
            this.drawTextBG(str[i], x, y + 28 * i);
        }
    }
    
    // Напечатать текст с фоном
    drawTextBG(txt, x, y) {
        /// lets save current state as we make a lot of changes
        this.ctx.save();
        /// draw text from top - makes life easier at the moment
        this.ctx.textBaseline = 'top';
        // get width of text
        let mt = this.ctx.measureText(txt);
        let width = mt.width;
        let height = mt.actualBoundingBoxDescent;
        // color for background
        this.ctx.fillStyle = 'rgba(0, 0, 0, .35)';
        if(txt) {
            // draw background rect assuming height of font
            this.ctx.fillRect(x, y, width + 4, height + 4);
        }
        // text color
        this.ctx.fillStyle = '#fff';
        // draw text on top
        this.ctx.fillText(txt, x + 2, y + 2);
        // restore original state
        this.ctx.restore();
    }

}