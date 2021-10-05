import {BLOCK} from "./blocks.js";
import { Vector } from "./helpers.js";

const MESSAGE_SHOW_TIME         = 10000; // максимальное время отображения текста, после закрытия чата (мс)
const SYSTEM_MESSAGE_SHOW_TIME  = 3000;
const SYSTEM_NAME               = '<MadCraft>';

export default class Chat {

    constructor() {
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
                this.add(SYSTEM_NAME, text, SYSTEM_MESSAGE_SHOW_TIME);
            },
            addError: function(text) {
                this.add(SYSTEM_NAME, text, SYSTEM_MESSAGE_SHOW_TIME);
            },
            add: function(nickname, text, timeout) {
                if(!timeout) {
                    timeout = 0;
                }
                this.list.unshift({
                    nickname:   nickname,
                    text:       text,
                    time:       performance.now() - timeout
                });
                if(this.list.length > this.history_max_messages) {
                    this.list.pop();
                }
            }
        };
        // 
        this.history = {
            list: [],
            draft: [],
            index: -1,
            add: function(buffer) {
                this.list.push(buffer);
                this.reset();
            },
            reset: function() {
                this.index = -1;
                this.draft = [];
            },
            navigate: function(go_back, buffer, onchange) {
                if(this.list.length < 1) {
                    return false;
                }
                if(buffer.length > 0 && this.index == -1) {
                    this.draft = buffer;
                }
                if(go_back) {
                    // up
                    this.index++;
                    if(this.index >= this.list.length - 1) {
                        this.index = this.list.length - 1;
                    }
                    onchange([...this.list[this.list.length - this.index - 1]]);
                } else {
                    // down
                    this.index--;
                    if(this.index >= 0) {
                        onchange([...this.list[this.list.length - this.index - 1]]);
                    } else if(this.index == -1) {
                        onchange(this.draft);
                        onchange([...this.draft]);
                        this.draft = [];
                    } else {
                        this.index = -1;
                    }
                }
            }
        };
        //
        Game.hud.add(this, 1);
    }

    //
    historyNavigate(go_back) {
        this.history.navigate(go_back, this.buffer, (new_buffer) => {
            this.buffer = new_buffer;
        });
    }

    open(start_buffer) {
        if(this.active) {
            return;
        }
        this.history.reset();
        this.buffer = start_buffer;
        this.active = true;
        this.open_time = performance.now();
        Game.hud.refresh();
        document.exitPointerLock();
    }
    
    close() {
        this.active = false;
        Game.hud.refresh();
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
            let temp = text.replace(/  +/g, ' ').split(' ');
            let cmd = temp.shift();
            switch(cmd.trim().toLowerCase()) {
                case '/tp': {
                    if(temp.length == 3) {
                        let x = parseFloat(temp[0].trim());
                        let y = parseFloat(temp[1].trim());
                        let z = parseFloat(temp[2].trim());
                        Game.world.localPlayer.setPosition(new Vector(x, y, z));
                    } else {
                        Game.world.localPlayer.chat.messages.addError(`Incorrect argument for command`);
                    }
                    break;
                }
                case '/seed': {
                    Game.world.localPlayer.chat.messages.addSystem('Ключ генератора [' + Game.world.seed + ']');
                    break;
                }
                case '/help': {
                    let commands = [
                        '/weather (clear | rain)',
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
                            default: {
                                Game.world.localPlayer.chat.messages.addError(`Incorrect argument for command`);
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
                            cnt = temp[1].trim();
                        } else {
                            name = temp[1].trim();
                            cnt = temp[2].trim();
                        }
                        cnt = Math.max(cnt | 0, 1);
                        let block = BLOCK[name.toUpperCase()];
                        if(block) {
                            block = {...block};
                            delete(block.texture);
                            block.count = cnt;
                            Game.world.localPlayer.inventory.increment(block);
                            Game.world.localPlayer.chat.messages.addSystem('Выдан: ' + block.name);
                        } else {
                            Game.world.localPlayer.chat.messages.addError(`Unknown item '${name}'`);
                        }
                    }
                    break;
                }
            }
        }
        this.history.add(this.buffer);
        this.buffer         = [];
        this.close();
    }

    hasDrawContent() {
        if(this.active) {
            return true;
        }
        for(let m of this.messages.list) {
            let time_diff = performance.now() - m.time;
            if(this.active || time_diff < MESSAGE_SHOW_TIME) {
                return true;
            }
        }
        return false;
    }

    drawHUD(hud) {

        const margin            = 10;
        const padding           = 5;
        const top               = 45;
        const now               = performance.now();
        const fadeout_time      = 2000; // время угасания текста перед счезновением (мс)
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
            if(this.active || time_diff < MESSAGE_SHOW_TIME) {
                let alpha = 1;
                if(!this.active) {
                    let time_remains = MESSAGE_SHOW_TIME - time_diff;
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