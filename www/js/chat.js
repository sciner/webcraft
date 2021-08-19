import {BLOCK} from "./blocks.js";

export default class Chat {

    constructor() {
        this.max_show_time          = 10000; // максимальное время отображения текста, после закрытия чата (мс)
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

    open(start_buffer) {
        if(this.active) {
            return;
        }
        this.buffer = start_buffer;
        this.active = true;
        this.open_time = performance.now();
        document.exitPointerLock();
        console.info('chat opened');
    }
    
    close() {
        this.active = false;
        console.info('chat closed');
    }
    
    typeChar(ch) {
        if(!this.active) {
            return;
        }
        this.buffer.push(ch);
    }
    
    backspace() {
        if(!this.active) {
            return;
        }
        if(this.buffer.length > 0) {
            this.buffer.pop();
        }
    }
    
    keyPress(keyCode) {
        if(!this.active) {
            return;
        }
    }
    
    submit() {
        if(!this.active) {
            return;
        }
        let text = this.buffer.join('');
        if(text != '' && text != '/') {
            this.messages.send(text);
            // Parse commands
            let temp = text.split(' ');
            let cmd = temp.shift();
            switch(cmd.trim().toLowerCase()) {
                case '/tp': {
                    if(temp.length == 3) {
                        let x = parseFloat(temp[0].trim());
                        let y = parseFloat(temp[1].trim());
                        let z = parseFloat(temp[2].trim());
                        Game.world.localPlayer.pos.x = x;
                        Game.world.localPlayer.pos.y = y;
                        Game.world.localPlayer.pos.z = z;
                    }
                    break;
                }
                case '/seed': {
                    Game.world.localPlayer.chat.messages.addSystem('Ключ генератора [' + Game.world.seed + ']');
                    break;
                }
                case '/help': {
                    let commands = [
                        '/weather (clear|rain)',
                        '/tp -> teleport',
                        '/spawnpoint',
                        '/seed',
                        '/give <item> [<count>]',
                    ];
                    Game.world.localPlayer.chat.messages.addSystem('\n' + commands.join('\n'));
                    break;
                }
                case '/spawnpoint': {
                    let np = Game.world.localPlayer.pos;
                    let pos = new Vector(
                        Math.round(np.x),
                        Math.round(Game.world.localPlayer.pos.y),
                        Math.round(Game.world.localPlayer.pos.z)
                    );
                    Game.world.spawnPoint = new Vector(np.x, np.y, np.z);
                    Game.world.saveToDB();
                    Game.world.localPlayer.chat.messages.addSystem('Установлена точка возрождения ' + pos.x + ', ' + pos.y + ', ' + pos.z);
                    break;
                }
                case '/weather': {
                    if(temp.length == 1) {
                        let name = temp[0].trim().toLowerCase();
                        switch(name) {
                            case 'rain': {
                                Game.world.setRain(true);
                                Game.world.localPlayer.chat.messages.addSystem('Установлена дождливая погода');
                                break;
                            }
                            case 'clear': {
                                Game.world.setRain(false);
                                Game.world.localPlayer.chat.messages.addSystem('Установлена ясная погода');
                                break;
                            }
                        }
                    }
                    break;
                }
                case '/obj': {
                    let mesh = new Mesh_Default(
                        Game.world.renderer.gl,
                        Game.world.localPlayer.pos,
                        '/vendors/Mickey Mouse.obj',
                        function(m) {
                            Game.world.meshes.add(m)
                        }
                    )
                    break;
                }
                case '/give': {
                    if(temp.length >= 1) {
                        let name = null;
                        let cnt = 1;
                        if(temp.length == 1) {
                            name = temp[0].trim();
                            cnt = 1;
                        } else if(temp.length == 2) {
                            name = temp[0].trim();
                            cnt = parseInt(temp[1].trim());
                        } else {
                            name = temp[1].trim();
                            cnt = parseInt(temp[2].trim());
                        }
                        let block = BLOCK[name.toUpperCase()];
                        if(block) {
                            block = {...block};
                            delete(block.texture);
                            block.count = cnt;
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

    hasDrawContent() {
        if(this.active) {
            return true;
        }
        for(let m of this.messages.list) {
            let time_diff = performance.now() - m.time;
            if(this.active || time_diff < this.max_show_time) {
                return true;
            }
        }
        return false;
    }
    
    drawHUD(hud) {

        const margin            = 10;
        const padding           = 5;
        const top               = 45;
        // const height            = 35;
        const now               = performance.now();
        const fadeout_time      = 2000; // время угасения текста перед счезновением (мс)
        const blink_period      = 500; // период моргания курсора ввода текста (мс)
    
        hud.ctx.save();
    
        // Calc text size
        hud.ctx.textAlign       = 'left';
        hud.ctx.textBaseline    = 'top';
        let mt                  = hud.ctx.measureText('TW|');
        let line_height         = mt.actualBoundingBoxDescent + 14;
        let y                   = hud.height - (top + margin + line_height);

        if(this.active) {
            hud.ctx.fillStyle = '#000000aa';
            hud.ctx.fillRect(margin, hud.height - top, hud.width - margin * 2, line_height);
            let text = this.buffer.join('');
            let how_long_open = Math.round(now - this.open_time);
            if(how_long_open % blink_period < blink_period * 0.5) {
                text += '_';
            }
            hud.drawText(text, margin + padding, hud.height - top + padding);
        }
    
        // Draw message history
        for(let m of this.messages.list) {
            let time_diff = now - m.time;
            if(this.active || time_diff < this.max_show_time) {
                let alpha = 1;
                if(!this.active) {
                    let time_remains = this.max_show_time - time_diff;
                    if(time_remains < fadeout_time) {
                        alpha = time_remains / fadeout_time;
                    }
                }
                let texts = m.text.split('\n');
                for(let i in texts) {
                    let text = texts[i];
                    if(i == 0) {
                        text = m.nickname + ': ' + text;
                    }
                    let aa = Math.ceil(170 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
                    hud.ctx.fillStyle = '#000000' + aa;
                    hud.ctx.fillRect(margin, y - padding, hud.width - margin * 2, line_height);
                    //
                    aa = Math.ceil(51 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
                    hud.ctx.fillStyle = '#000000' + aa;
                    hud.ctx.fillText(text, margin + padding, y + 4);
                    //
                    aa = Math.ceil(255 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
                    hud.ctx.fillStyle = '#ffffff' + aa;
                    hud.ctx.fillText(text, margin + padding + 2, y + 2);
                    //
                    y -= line_height;
                }
            }
        }

        // Restore original state
        hud.ctx.restore();

    }

}