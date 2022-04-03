import {Mesh_Default} from "./mesh/default.js";
import {ServerClient} from "./server_client.js";
import {BLINK_PERIOD} from "../tools/gui/wm.js";

const MESSAGE_SHOW_TIME         = 10000; // максимальное время отображения текста, после закрытия чата (мс)
const SYSTEM_MESSAGE_SHOW_TIME  = 3000;
const SYSTEM_NAME               = '<MadCraft>';

export class Chat {

    zoom = UI_ZOOM;

    constructor(player) {
        let that                    = this;
        this.player                 = player;
        this.active                 = false;
        this.buffer                 = [];
        this.history_max_messages   = 64;
        this.resetCarriage();
        this.messages = {
            list: [],
            send: function(text) {
                this.add('YOU', text);
                that.player.world.server.SendMessage(text);
                Game.setupMousePointer(true);
            },
            addSystem: function(text) {
                this.add(SYSTEM_NAME, text, SYSTEM_MESSAGE_SHOW_TIME);
            },
            addError: function(text) {
                this.add(SYSTEM_NAME, text, SYSTEM_MESSAGE_SHOW_TIME);
            },
            add: function(username, text, timeout) {
                text = String(text);
                if(!timeout) {
                    timeout = 0;
                }
                this.list.unshift({
                    username:   username,
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
        // Add listeners for server commands
        this.player.world.server.AddCmdListener([ServerClient.CMD_CHAT_SEND_MESSAGE], (cmd) => {
            this.messages.add(cmd.data.username, cmd.data.text);
        });
    }

    // Reset carriage
    resetCarriage() {
        this.carriage = this.buffer.length;
    }

    // Move carriage
    moveCarriage(cnt) {
        this.carriage += cnt;
        this.carriage = Math.min(Math.max(this.carriage, 0), this.buffer.length);
    }

    //
    historyNavigate(go_back) {
        this.history.navigate(go_back, this.buffer, (new_buffer) => {
            this.buffer = new_buffer;
            this.resetCarriage();
        });
    }

    open(start_buffer) {
        if(this.active) {
            return;
        }
        this.history.reset();
        this.buffer = start_buffer;
        this.resetCarriage();
        this.active = true;
        this.open_time = performance.now();
        Game.hud.refresh();
        document.exitPointerLock();
    }
    
    close() {
        this.active = false;
        Game.hud.refresh();
    }
    
    typeChar(charCode, ch) {
        if(!this.active) {
            return;
        }
        if(charCode == 13) {
            return this.submit();
        }
        if(this.carriage < this.buffer.length) {
            this.buffer.splice(this.carriage, 0, ch);
        } else {
            this.buffer.push(ch);
        }
        this.moveCarriage(1);
    }

    pasteText(text) {
        if(!this.active) {
            return false;
        }
        text = text.trim();
        let chars = text.split('');
        if(chars.length > 0) {
            if(this.carriage < this.buffer.length) {
                this.buffer.splice(this.carriage, 0, ...chars);
            } else {
                this.buffer.push(...chars);
            }
            this.moveCarriage(chars.length);
        }
    }
    
    backspace() {
        if(!this.active) {
            return;
        }
        if(this.buffer.length > 0) {
            if(this.carriage == this.buffer.length) {
                this.buffer.pop();
            } else {
                this.buffer.splice(this.carriage - 1, 1);
            }
            this.moveCarriage(-1);
        }
    }

    onKeyDel() {
        if(this.carriage < this.buffer.length) {
            this.buffer.splice(this.carriage, 1);
            this.moveCarriage(0);
        }
    }

    onKeyHome() {
        this.moveCarriage(-this.buffer.length);
    }

    onKeyEnd() {
        this.moveCarriage(this.buffer.length);
    }
    
    keyPress(keyCode) {
        if(!this.active) {
            return;
        }
    }

    sendMessage(text) {
        this.active = true;
        this.buffer = text.split('');
        this.resetCarriage();
        this.submit();
        this.active = false;
    }
    
    submit() {
        if(!this.active) {
            return;
        }
        let world   = Game.world;
        let player  = Game.player;
        let chat    = Game.player.chat;
        let text    = this.buffer.join('');
        if(text != '' && text != '/') {
            this.messages.send(text);
            // Parse commands
            let temp = text.replace(/  +/g, ' ').split(' ');
            let cmd = temp.shift();
            switch(cmd.trim().toLowerCase()) {
                case '/weather': {
                    if(temp.length == 1) {
                        let name = temp[0].trim().toLowerCase();
                        switch(name) {
                            case 'rain': {
                                Game.render.setRain(true);
                                chat.messages.addSystem('Установлена дождливая погода');
                                break;
                            }
                            case 'clear': {
                                Game.render.setRain(false);
                                chat.messages.addSystem('Установлена ясная погода');
                                break;
                            }
                            default: {
                                chat.messages.addError(`Incorrect argument for command`);
                            }
                        }
                    }
                    break;
                }
                case '/obj': {
                    new Mesh_Default(
                        Game.render.gl,
                        player.pos,
                        '/vendors/Mickey Mouse.obj',
                        function(m) {
                            world.meshes.add(m)
                        }
                    )
                    break;
                }
            }
        }
        this.history.add(this.buffer);
        this.buffer = [];
        this.resetCarriage();
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

        const margin            = 10 * this.zoom;
        const padding           = 5 * this.zoom;
        const top               = 45 * this.zoom;
        const now               = performance.now();
        const fadeout_time      = 2000; // время угасания текста перед счезновением (мс)

        hud.ctx.save();

        const CHAT_INPUT_FONT = 'UbuntuMono-Regular'; // UI_FONT

        // Calc text size
        hud.ctx.font            = Math.round(18 * this.zoom) + 'px ' + CHAT_INPUT_FONT;
        hud.ctx.textAlign       = 'left';
        hud.ctx.textBaseline    = 'top';

        if(!this.line_height) {
            let mt = hud.ctx.measureText('TW|');
            this.line_height = mt.actualBoundingBoxDescent + 14 * this.zoom;
        }

        let y = hud.height - (top + margin + this.line_height);

        if(this.active) {
            hud.ctx.fillStyle = '#000000aa';
            hud.ctx.fillRect(margin, hud.height - top, hud.width - margin * 2, this.line_height);
            let text = this.buffer.join('');
            let how_long_open = Math.round(now - this.open_time);
            if(how_long_open % BLINK_PERIOD < BLINK_PERIOD * 0.5) {
                if(this.carriage == this.buffer.length) {
                    text += '_';
                } else {
                    // const carriage_height = 4;
                    const text_start = this.buffer.slice(0, this.carriage).join('');
                    // const ch = this.buffer[this.carriage];
                    let m_start = hud.ctx.measureText(text_start).width;
                    // let m_width = hud.ctx.measureText(ch).width;
                    // hud.ctx.fillStyle = '#ffffffaa';
                    hud.drawText('_', margin + padding + m_start, hud.height - top + padding);
                    // hud.ctx.fillRect(margin + padding + m_start, hud.height - top + this.line_height - carriage_height, m_width, carriage_height);
                }
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
                        text = m.username + ': ' + text;
                    }
                    let aa = Math.ceil(170 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
                    hud.ctx.fillStyle = '#000000' + aa;
                    hud.ctx.fillRect(margin, y - padding, hud.width - margin * 2, this.line_height);
                    //
                    aa = Math.ceil(51 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
                    hud.ctx.fillStyle = '#000000' + aa;
                    hud.ctx.fillText(text, margin + padding, y + 4 * this.zoom);
                    //
                    aa = Math.ceil(255 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
                    hud.ctx.fillStyle = '#ffffff' + aa;
                    hud.ctx.fillText(text, margin + padding + 2, y + 2 * this.zoom);
                    //
                    y -= this.line_height;
                }
            }
        }

        // Restore original state
        hud.ctx.restore();

    }

    // Hook for keyboard input.
    onKeyEvent(e) {
        const {keyCode, down, first} = e;
        switch(keyCode) {
            case KEY.ARROW_UP:
            case KEY.ARROW_DOWN: {
                if(down) {
                    this.historyNavigate(keyCode == KEY.ARROW_UP);
                    return true;
                }
                break;
            }
            case KEY.F5: {
                return false;
                break;
            }
            case KEY.ESC: {
                if(down) {
                    this.close();
                    // Game.setupMousePointer(true);
                    return true;
                }
                break;
            }
            case KEY.BACKSPACE: {
                if(down) {
                    this.backspace();
                    break;
                }
                return true;
            }
            case KEY.DEL: {
                if(down) {
                    this.onKeyDel();
                    break;
                }
                return true;
            }
            case KEY.HOME: {
                if(down) {
                    this.onKeyHome();
                    break;
                }
                return true;
            }
            case KEY.END: {
                if(down) {
                    this.onKeyEnd();
                    break;
                }
                return true;
            }
            case KEY.ARROW_LEFT: {
                if(down) {
                    this.moveCarriage(-1);
                    break;
                }
                return true;
            }
            case KEY.ARROW_RIGHT: {
                if(down) {
                    this.moveCarriage(1);
                    break;
                }
                return true;
            }
            case KEY.ENTER: {
                if(!down) {
                    this.submit();
                }
                return true;
                break;
            }
        }
    }

}