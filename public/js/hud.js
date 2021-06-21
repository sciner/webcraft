const HUD_WIDTH             = 700;
const HUD_HEIGHT            = 700;

function requestCORSIfNotSameOrigin(img, url) {
    if ((new URL(url, window.location.href)).origin !== window.location.origin) {
        img.crossOrigin = '';
    }
}

function HUD(width, height) {

    // Create canvas used to draw HUD
    var canvas                      = this.canvas = document.createElement('canvas');
    canvas.width                    = width;
    canvas.height                   = width;
    canvas.style.display            = 'none';
    canvas.style.zIndex             = 0;
    canvas.style.pointerEvents      = 'none';
    this.ctx                        = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled  = false;
    document.body.appendChild(this.canvas);
    this.active                     = true;
    this.draw_info                  = true;

    this.texture                    = null;
    this.buffer                     = null;
    this.width                      = width;
    this.height                     = height;
    this.items                      = [];

    var HUD = this;

    // Splash screen (Loading...)
    this.splash = {
        loading:    true,
        image:      null,
        hud:        null,
        init: function(hud) {    
            var that = this;
            that.hud = hud;
            var image = new Image();
            image.onload = function() {
                that.image = this;
            }
            image.src = '../media/background.png';
        },
        draw: function() {
            var cl = 0; //Object.entries(Game.world.chunkManager.chunks).length;
            for(const [key, chunk] of Object.entries(Game.world.chunkManager.chunks)) {
                if(chunk.inited) {
                    cl++;
                }
            }
            var nc = 45;
            var w = this.hud.width;
            var h = this.hud.height;
            this.loading = cl < nc;
            if(!this.loading) {
                return false;
            }
            var ctx = this.hud.ctx;
            ctx.save();
            if(this.image) {
                for(var x = 0; x < w; x += this.image.width) {
                    for(var y = 0; y < h; y += this.image.height) {
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
            var txt = 'LOADING ... ' + Math.round(cl / nc * 100) + '%';
            //
            var x = w / 2;
            var y = h / 2 + 50;
            var padding = 15;
            /// draw text from top - makes life easier at the moment
            ctx.textBaseline = 'top';
            // get width of text
            var mt = ctx.measureText(txt);
            var width = mt.width;
            var height = mt.actualBoundingBoxDescent;
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
    var wm = this.wm = new WindowManager(this.canvas, this.ctx, 0, 0, this.canvas.width, this.canvas.height);
    wm.style.background.color       = '#00000000';
    wm.style.border.hidden          = true;
    wm.pointer.visible              = false;

    // Main menu
    this.frmMainMenu = new MainMenu(10, 10, 352, 332, 'frmMainMenu', null, null, this)
    wm.add(this.frmMainMenu);

    // Debug debug layer
    /*
        this.lblDebug = new Label(15, 15, 500, 500, 'lblDebug');
        this.lblDebug.style.font.size = 25;
        this.lblDebug.style.color = '#ffff00ff';
        this.lblDebug.setText('mat: CRAFTING_TABLE; id: 58');
        wm.add(this.lblDebug);
    */

}

HUD.prototype.add = function(item, zIndex) {
    if(!this.items[zIndex]) {
        this.items[zIndex] = [];
    }
    this.items[zIndex].push({item: item});
}

HUD.prototype.clear = function() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
}

//
HUD.prototype.toggleActive = function() {
    this.active = !this.active;
}

//
HUD.prototype.isActive = function() {
    return this.active;
}

HUD.prototype.draw = function() {

    var that = this;

    this.frmMainMenu.parent.center(this.frmMainMenu);

    // var new_width =  Math.round(Game.canvas.width / 2);
    // var new_height = Math.round(Game.canvas.height / 2);

    if(Game.canvas.width > Game.canvas.height) {
        var new_width =  Math.round(352 * 4.5);
        var new_height = Math.round(new_width * (Game.canvas.height / Game.canvas.width));
    } else {
        var new_height =  Math.round(332 * 3.5);
        var new_width = Math.round(new_height * (Game.canvas.width / Game.canvas.height));
    }

    if(Game.hud.width != new_width || Game.hud.height != new_height) {
        // console.log('HUD ' + new_width + 'x' + new_height);
        this.width  = this.ctx.canvas.width   = new_width;
        this.height = this.ctx.canvas.height  = new_height;
        this.ctx.font = '24px Minecraftia';
        Game.hud.wm.resize(this.width, this.height);
    }

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
        this.drawInfo(this);
        // Draw HUD components
        for(var t of this.items) {
            for(var e of t) {
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

// Draw game technical info
HUD.prototype.drawInfo = function(hud) {
    if(!this.draw_info) {
        return;
    }
    if(Game.loopTime) {
        text += '\nLOOP_TIME: ' + [
            Math.round(Game.loopTime.min * 10) / 10,
            Math.round(Game.loopTime.max * 10) / 10,
            Math.round(Game.loopTime.avg * 10) / 10
        ].join(' / ');
    }
    // text += '\nREAL FPS: ' +  Math.round(1000 / Game.loopTime.avg);
    var text = 'FPS: ' + Math.round(fps.fps) + ' /' + Math.round(1000 / Game.loopTime.avg);
    text += '\nMAT: ';
    var mat = Game.player.buildMaterial;
    if(mat) {
        text += ' ' + mat.id + ' / ' + mat.name;
        if(mat.fluid) {
            text += ' ' + '(FLUID!!!)';
        }
    } else {
        text += 'NULL';
    }
    if(performance.now() - Game.last_saved_time < 3000) {
        text += '\nSaved ... OK';
    }
    // text += '\nUsername: ' + Game.username;
    if(Game.world.server.ping_value) {
        text += '\nPING: ' + Math.round(Game.world.server.ping_value) + ' ms';
    }
    text += '\nYAW: ' + Math.round(Game.world.rotateDegree.y);
    // Chunks inited
    text += '\nChunks inited: ' + Game.world.chunkManager.rendered_chunks.fact + ' / ' + Game.world.chunkManager.rendered_chunks.total;
    //
    var vertices_length_total = 0;
    for(const[key, chunk] of Object.entries(Game.world.chunkManager.chunks)) {
        vertices_length_total += chunk.vertices_length;
    }
    text += '\nVertices: ' + vertices_length_total.toLocaleString(undefined, {minimumFractionDigits: 0}) + 
        ' / ' + Math.round(vertices_length_total * 12 * 4 / 1024 / 1024) + 'Mb';
    
    //
    text += '\nChunks update: ' + (Game.world.chunkManager.update_chunks ? 'ON' : 'OFF');
    // Console =)
    var playerBlockPos = Game.world.localPlayer.getBlockPos();
    var chunk = Game.world.localPlayer.overChunk;
    text += '\nXYZ: ' + playerBlockPos.x + ', ' + playerBlockPos.y + ', ' + playerBlockPos.z;
    if(chunk) {
        text += '\nCHUNK: ' + chunk.addr.x + ', ' + chunk.addr.y + ', ' + chunk.addr.z + '\n';
        // text += 'CHUNK_XYZ: ' + chunk.coord.x + ', ' + chunk.coord.y + ', ' + chunk.coord.z + '\n';
    }
    // Players list
    text += '\nOnline:\n';
    for(const [id, player] of Object.entries(Game.world.players)) {
        if(id == 'itsme') {
            continue;
        }
        text += '🙎‍♂️' + player.nick;
        if(player.itsme) {
            text += ' <- YOU';
        } else {
            text += ' ... ' + Math.floor(Helpers.distance(player.pos, Game.world.localPlayer.pos)) + 'm';
        }
        text += '\n';
    }
    hud.drawText(text, 10, 10);
}

// Просто функция печати текста
HUD.prototype.drawText = function(str, x, y) {
    this.ctx.fillStyle = '#ffffff';
    str = str.split('\n');
    for(var i in str) {
        this.drawTextBG(str[i], x, y + 28 * i);
    }
}

// Напечатать текст с фоном
HUD.prototype.drawTextBG = function(txt, x, y) {
    /// lets save current state as we make a lot of changes        
    this.ctx.save();
    /// draw text from top - makes life easier at the moment
    this.ctx.textBaseline = 'top';
    // get width of text
    var mt = this.ctx.measureText(txt);
    var width = mt.width;
    var height = mt.actualBoundingBoxDescent;
    // color for background
    this.ctx.fillStyle = 'rgba(0, 0, 0, .25)';
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
