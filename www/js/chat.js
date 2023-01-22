import { ServerClient } from "./server_client.js";
import { Lang } from "./lang.js";
import { TextBox } from "./ui/textbox.js";

const MESSAGE_SHOW_TIME         = 7000; // максимальное время отображения текста, после закрытия чата (мс)
const SYSTEM_MESSAGE_SHOW_TIME  = 3000;
const SYSTEM_NAME               = '<MadCraft>';

export class Chat extends TextBox {

    constructor(player) {
        super(UI_ZOOM);
        let that                    = this;
        this.player                 = player;
        this.history_max_messages   = 64;
        this.messages = {
            list: [],
            send(text) {
                this.add('YOU', text);
                if(text.trim().toLowerCase() == '/ping') {
                    that.send_ping = performance.now();
                }
                that.player.world.server.SendMessage(text);
                Qubatch.setupMousePointer(true);
            },
            addSystem(text) {
                this.add(SYSTEM_NAME, text, SYSTEM_MESSAGE_SHOW_TIME);
            },
            addError(text) {
                this.add(SYSTEM_NAME, text, SYSTEM_MESSAGE_SHOW_TIME);
            },
            add(username, text, timeout) {
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
            add(buffer) {
                this.list.push(buffer);
                this.save();
                this.reset();
            },
            save() {
                const saved_arr = Array.from(this.list.slice(-64));
                localStorage.setItem(`chat_history_${that.player.world.info.guid}`, JSON.stringify(saved_arr));
            },
            clear() {
                this.list = [];
                this.save();
            },
            reset() {
                this.index = -1;
                this.draft = [];
            },
            navigate(go_back, buffer, onchange) {
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
        Qubatch.hud.add(this, 1);
        // Add listeners for server commands
        this.player.world.server.AddCmdListener([ServerClient.CMD_CHAT_SEND_MESSAGE], (cmd) => {
            if(cmd.data.is_system) {
                if(cmd.data.text == 'pong') {
                    const elpapsed = Math.round((performance.now() - that.send_ping) * 1000) / 1000;
                    cmd.data.text += ` ${elpapsed} ms`;
                } else {
                    cmd.data.text = Lang[cmd.data.text];
                }
            }
            this.messages.add(cmd.data.username, cmd.data.text);
        });
        // Restore sent history
        let hist = localStorage.getItem(`chat_history_${that.player.world.info.guid}`);
        if(hist) {
            hist = JSON.parse(hist);
            if(Array.isArray(hist)) {
                for(let i = 0; i < hist.length; i++) {
                    const buf = hist[i];
                    if(Array.isArray(buf)) {
                        this.history.add(buf);
                    }
                }
            }
        }
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
        Qubatch.hud.refresh();
        // no need
        // document.exitPointerLock();
    }

    close() {
        this.active = false;
        Qubatch.hud.refresh();
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
        const text = this.buffer.join('');
        if(text != '' && text != '/') {
            //
            const render    = Qubatch.render;
            const player    = this.player;
            const chat      = player.chat;
            // Parse commands
            const temp      = text.replace(/  +/g, ' ').split(' ');
            const cmd       = temp.shift();
            let no_send = false;
            switch(cmd.trim().toLowerCase()) {
                case '/clusterborders': {
                    if(temp.length && temp[0].trim().length > 0) {
                        const value = temp[0].toLowerCase();
                        if(['true', 'false'].includes(value)) {
                            Qubatch.world.chunkManager.setDebugClusterGridVisibility(value == 'true');
                        }
                    } else {
                        Qubatch.world.chunkManager.toggleDebugClusterGrid()
                    }
                    no_send = true;
                    break;
                }
                case '/chunkborders': {
                    if(temp.length && temp[0].trim().length > 0) {
                        const value = temp[0].toLowerCase();
                        if(['true', 'false'].includes(value)) {
                            Qubatch.world.chunkManager.setDebugGridVisibility(value == 'true');
                        }
                    } else {
                        Qubatch.world.chunkManager.toggleDebugGrid()
                    }
                    no_send = true;
                    break;
                }
                case '/mobborders': {
                    if(temp.length && temp[0].trim().length > 0) {
                        const value = temp[0].toLowerCase();
                        if(['true', 'false'].includes(value)) {
                            Qubatch.world.mobs.setDebugGridVisibility(value == 'true');
                        }
                    } else {
                        Qubatch.world.mobs.toggleDebugGrid()
                    }
                    no_send = true;
                    break;
                }
                case '/exportglb': {
                    const name = (temp[0] || '').trim() || Qubatch.world.info.title
                    Qubatch.world.chunkManager.export.encode( Qubatch.render.camPos, name );
                    no_send = true;
                    break;
                }
                case '/blockinfo': {
                    if(temp.length && temp[0].trim().length > 0) {
                        const value = temp[0].toLowerCase();
                        if(['true', 'false'].includes(value)) {
                            Qubatch.hud.draw_block_info = value == 'true';
                        }
                    } else {
                        Qubatch.hud.draw_block_info = !Qubatch.hud.draw_block_info;
                    }
                    no_send = true;
                    break;
                }
                case '/deepdark': {
                    const value = (temp[0] || '').trim().toLowerCase();
                    if(['on', 'off', 'auto'].includes(value)) {
                        Qubatch.render.env.deepDarkMode = value;
                    } else {
                        this.messages.add(SYSTEM_NAME, '/deepdark (auto | on | off)');
                        this.messages.add(SYSTEM_NAME, '   auto: on for players, off for spectators');
                    }
                    no_send = true;
                    break;
                }
                case '/bb': {
                    let bbname = null;
                    let animation_name = null;
                    if(temp.length > 0) bbname = temp.shift().trim();
                    if(temp.length > 0) animation_name = temp.shift().trim();
                    Qubatch.render.addBBModel(player.lerpPos.clone(), bbname, Qubatch.player.rotate, animation_name);
                    no_send = true;
                    break;
                }
                case '/clear': {
                    this.history.clear();
                    break;
                }
            }
            if(!no_send) {
                this.messages.send(text);
            }
            this.history.add(this.buffer);
            this.buffer = [];
            this.resetCarriage();
        }
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

    /**
     * @param { import("./hud.js").HUD } hud
     * @returns 
     */
    drawHUD(hud) {

        const margin            = 10 * this.zoom;
        const multiLineMarginAdd= 10 * this.zoom; // additional left margin for multi-line messages
        const padding           = this.style.padding;
        const top               = 45 * this.zoom;
        const now               = performance.now();
        const fadeout_time      = 2000; // время угасания текста перед счезновением (мс)

        if(!this.chat_input) {
            this.init(hud)
        }

        const x = margin
        const y = hud.height - (top + margin + this.line_height)
        const input_width = hud.width - margin * 2
        const input_height = this.line_height

        this.chat_input.visible = this.active
        if(this.active) {
            this.draw(x, hud.height - top, input_width, input_height, margin)
        }

        // TODO: pixi
        return

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
                for(let i = texts.length - 1; i >= 0; i--) {
                    let text = texts[i];
                    var leftMargin = margin;
                    if(i == 0) {
                        text = m.username + ': ' + text;
                    } else {
                        leftMargin += multiLineMarginAdd;
                    }
                    let aa = Math.ceil(170 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
                    hud.ctx.fillStyle = '#000000' + aa;
                    hud.ctx.fillRect(leftMargin, y - padding, hud.width - margin - leftMargin, this.line_height);
                    //
                    aa = Math.ceil(51 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
                    hud.ctx.fillStyle = '#000000' + aa;
                    hud.ctx.fillText(text, leftMargin + padding, y + 4 * this.zoom);
                    //
                    aa = Math.ceil(255 * alpha).toString(16); if(aa.length == 1) {aa = '0' + aa;}
                    hud.ctx.fillStyle = '#ffffff' + aa;
                    hud.ctx.fillText(text, leftMargin + padding + 2, y + 2 * this.zoom);
                    //
                    y -= this.line_height;
                }
            }
        }

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
            case KEY.ESC: {
                if(down) {
                    this.close();
                    // Qubatch.setupMousePointer(true);
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