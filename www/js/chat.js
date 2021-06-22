function Chat() {
    this.active                 = false;
    this.buffer                 = [];
    this.history_max_messages   = 64;
    this.messages = {
        list: [],
        send: function(text) {
            this.add('YOU', text);
            Game.world.server.SendMessage(text);
            Game.setupMousePointerIfNoOpenWindows();
        },
        addSystem: function(text) {
            this.add('<WebCraft>', text);
        },
        add: function(nickname, text) {
            this.list.unshift({
                nickname:   nickname,
                text:       text,
                time:       performance.now()
            });
            if(this.list.length > this.history_max_messages) {
                this.list.pop();
            }
        }
    };
    Game.hud.add(this, 1);
}

Chat.prototype.open = function(start_buffer) {
    if(this.active) {
        return;
    }
    this.buffer = start_buffer;
    this.active = true;
    this.open_time = performance.now();
    document.exitPointerLock();
    console.info('chat opened');
}

Chat.prototype.close = function() {
    this.active = false;
    console.info('chat closed');
}

Chat.prototype.typeChar = function(ch) {
    if(!this.active) {
        return;
    }
    this.buffer.push(ch);
}

Chat.prototype.backspace = function() {
    if(!this.active) {
        return;
    }
    if(this.buffer.length > 0) {
        this.buffer.pop();
    }
}

Chat.prototype.keyPress = function(keyCode) {
    if(!this.active) {
        return;
    }
}

Chat.prototype.submit = function() {
    if(!this.active) {
        return;
    }
    var text = this.buffer.join('');
    if(text != '' && text != '/') {
        this.messages.send(text);
        // Parse commands
        var temp = text.split(' ');
        var cmd = temp.shift();
        switch(cmd.trim().toLowerCase()) {
            case '/tp': {
                if(temp.length == 3) {
                    var x = parseInt(temp[0].trim());
                    var y = parseInt(temp[1].trim());
                    var z = parseInt(temp[2].trim());
                    Game.world.localPlayer.pos.x = x;
                    Game.world.localPlayer.pos.y = y;
                    Game.world.localPlayer.pos.z = z;
                }
                break;
            }
            case '/give': {
                if(temp.length >= 2) {
                    if(temp.length == 2) {
                        var name = temp[0].trim().toUpperCase();
                        var cnt = parseInt(temp[1].trim());
                    } else {
                        var name = temp[1].trim();
                        var cnt = parseInt(temp[2].trim());
                    }
                    var block = BLOCK[name];
                    if(block) {
                        block = Object.assign({}, block);
                        delete(block.texture);
                        block.count = cnt;
                        console.log(block);
                        Game.world.localPlayer.inventory.increment(block);
                    }
                }
                break;
            }
        }
    }
    this.buffer = [];
    this.close();
}

Chat.prototype.drawHUD = function(hud) {

    const margin            = 10;
    const padding           = 5;
    const top               = 45;
    // const height            = 35;
    const now               = performance.now();
    const max_show_time     = 10000; // максимальное время отображения текста, после закрытия чата (мс)
    const fadeout_time      = 2000; // время угасения текста перед счезновением (мс)
    const blink_period      = 500; // период моргания курсора ввода текста (мс)

    hud.ctx.save();

    // Calc text size
    hud.ctx.textAlign       = 'left';
    hud.ctx.textBaseline    = 'top';
    var mt = hud.ctx.measureText('TW|');
    var line_height = mt.actualBoundingBoxDescent + 14;
    var y = hud.height - (top + margin + line_height);

    if(this.active) {
        hud.ctx.fillStyle = '#000000aa';
        hud.ctx.fillRect(margin, hud.height - top, hud.width - margin * 2, line_height);
        var text = this.buffer.join('');
        var how_long_open = Math.round(performance.now() - this.open_time);
        if(how_long_open % blink_period < blink_period * 0.5) {
            text += '_';
        }
        hud.drawText(text, margin + padding, hud.height - top + padding);
    }

    // Draw message history
    for(var m of this.messages.list) {
        var time_diff = performance.now() - m.time;
        if(this.active || time_diff < max_show_time) {
            var alpha = 1;
            if(!this.active) {
                var time_remains = max_show_time - time_diff;
                if(time_remains < fadeout_time) {
                    alpha = time_remains / fadeout_time;
                }
            }
            var aa = Math.ceil(170 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
            hud.ctx.fillStyle = '#000000' + aa;
            hud.ctx.fillRect(margin, y - padding, hud.width - margin * 2, line_height);
            //
            aa = Math.ceil(51 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
            hud.ctx.fillStyle = '#000000' + aa;
            hud.ctx.fillText(m.nickname + ': ' + m.text, margin + padding, y + 4);
            //
            aa = Math.ceil(255 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
            hud.ctx.fillStyle = '#ffffff' + aa;
            hud.ctx.fillText(m.nickname + ': ' + m.text, margin + padding + 2, y + 2);
            //
            y -= line_height;
        }
    }

    // Restore original state
    hud.ctx.restore();

}