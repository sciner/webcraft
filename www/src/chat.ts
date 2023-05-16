import { ServerClient } from "./server_client.js";
import { Lang } from "./lang.js";
import { TextBox } from "./ui/textbox.js";
import { HTMLText, Label, Window } from "./ui/wm.js";
import { KEY, UI_THEME } from "./constant.js";
import type { KbEvent } from "./kb.js";
import { Resources } from "./resources.js";
import type { HUD } from "./hud.js";
import { Mth, StringHelpers } from "./helpers.js";

const COUNT_LINES = 17
const COUNT_CHARS_IN_LINE = 49
const SYSTEM_NAME = '<MadCraft>';

export class Chat extends TextBox {

    #shift: number
    #count: number

    constructor(player) {
        super(UI_ZOOM * Qubatch.settings.window_size / 100);
        this.zoom = UI_ZOOM * Qubatch.settings.window_size / 100
        const that = this
        this.player = player
        this.history_max_messages = 64
        this.old_time = -1
        this.messages = {
            updateID: 0,
            list: [],
            send(text) {
                this.add('YOU', text);
                if (text.trim().toLowerCase() == '/ping') {
                    that.send_ping = performance.now();
                }
                that.player.world.server.SendMessage(text);
                Qubatch.setupMousePointer(true);
            },
            addSystem(text) {
                this.add(SYSTEM_NAME, text);
            },
            addError(text) {
                this.add(SYSTEM_NAME, text);
            },
            add(username, text) {
                this.updateID++
                text = String(text);
                this.list.unshift({
                    username: username,
                    text: text
                });
                if (this.list.length > this.history_max_messages) {
                    this.list.pop();
                }
                that.old_time = performance.now()
            }
        };
        //
        this.history = {
            last: null,
            list: [],
            draft: [],
            index: -1,
            add(buffer) {
                if (JSON.stringify(this.last) === JSON.stringify(buffer)) {
                    return
                }
                this.last = buffer
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
                if (this.list.length < 1) {
                    return false;
                }
                if (buffer.length > 0 && this.index == -1) {
                    this.draft = buffer;
                }
                if (go_back) {
                    // up
                    this.index++;
                    if (this.index >= this.list.length - 1) {
                        this.index = this.list.length - 1;
                    }
                    onchange([...this.list[this.list.length - this.index - 1]]);
                } else {
                    // down
                    this.index--;
                    if (this.index >= 0) {
                        onchange([...this.list[this.list.length - this.index - 1]]);
                    } else if (this.index == -1) {
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
            if (cmd.data.is_system) {
                if (cmd.data.text == 'pong') {
                    const elpapsed = Math.round((performance.now() - that.send_ping) * 1000) / 1000;
                    cmd.data.text += ` ${elpapsed} ms`;
                } else {
                    cmd.data.text = Lang[cmd.data.text];
                }
            }
            this.messages.add(cmd.data.username, cmd.data.text)
            this.onPosChat()
        })
        // Restore sent history
        let hist = localStorage.getItem(`chat_history_${that.player.world.info.guid}`);
        if (hist) {
            hist = JSON.parse(hist);
            if (Array.isArray(hist)) {
                for (let i = 0; i < hist.length; i++) {
                    const buf = hist[i];
                    if (Array.isArray(buf)) {
                        this.history.add(buf);
                    }
                }
            }
        }
        this.hud_atlas = Resources.atlas.get('hud')
        this.#shift = 0
    }

    //
    historyNavigate(go_back) {
        this.history.navigate(go_back, this.buffer, (new_buffer) => {
            this.buffer = new_buffer
            this.resetCarriage()
        });
    }

    open(start_buffer) {
        if (this.active) {
            return
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

    sendMessage(text : string) {
        this.active = true;
        this.buffer = text.split('')
        this.resetCarriage();
        this.submit()
        this.active = false
    }

    submit() : boolean {
        if (!this.active) {
            return false
        }
        const text = this.buffer.join('').trim()
        if (text != '' && text != '/') {
            const player = this.player
            // Parse commands
            const temp = text.replace(/  +/g, ' ').split(' ');
            const cmd = temp.shift();
            let no_send = false;
            switch (cmd.trim().toLowerCase()) {
                case '/clusterborders': {
                    if (temp.length && temp[0].trim().length > 0) {
                        const value = temp[0].toLowerCase();
                        if (['true', 'false'].includes(value)) {
                            Qubatch.world.chunkManager.setDebugClusterGridVisibility(value == 'true');
                        }
                    } else {
                        Qubatch.world.chunkManager.toggleDebugClusterGrid()
                    }
                    no_send = true;
                    break;
                }
                case '/chunkborders': {
                    if (temp.length && temp[0].trim().length > 0) {
                        const value = temp[0].toLowerCase();
                        if (['true', 'false'].includes(value)) {
                            Qubatch.world.chunkManager.setDebugGridVisibility(value == 'true');
                        }
                    } else {
                        Qubatch.world.chunkManager.toggleDebugGrid()
                    }
                    no_send = true;
                    break;
                }
                case '/mobborders': {
                    if (temp.length && temp[0].trim().length > 0) {
                        const value = temp[0].toLowerCase();
                        if (['true', 'false'].includes(value)) {
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
                    Qubatch.world.chunkManager.export.encode(Qubatch.render.camPos, name);
                    no_send = true;
                    break;
                }
                case '/blockinfo': {
                    if (temp.length && temp[0].trim().length > 0) {
                        const value = temp[0].toLowerCase();
                        if (['true', 'false'].includes(value)) {
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
                    if (['on', 'off', 'auto'].includes(value)) {
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
                    if (temp.length > 0) bbname = temp.shift().trim();
                    if (temp.length > 0) animation_name = temp.shift().trim();
                    Qubatch.render.addBBModel(player.lerpPos.clone(), bbname, Qubatch.player.rotate, animation_name);
                    no_send = true;
                    break;
                }
                case '/clear': {
                    this.history.clear();
                    break;
                }
                case '/emote': {
                    player.setAnimation(`emote_${temp[0]}`)
                    no_send = true;
                    break
                }
                case '/anim': {
                    player.setAnimation(temp[0], temp[1], temp[2])
                    no_send = true;
                    break
                }
                case '/debugplayer':
                    player.updateDebugValues(temp)
                    break
            }
            if (!no_send) {
                this.messages.send(text);
            }
            this.history.add(this.buffer);
        }
        this.buffer = []
        this.resetCarriage()
        this.close()
        this.onPosChat()
        return true
    }

    makeLines(list : any[]) : string[] {
        let lines = []
        const replaceUsername = (str : string, username : string) : string => {
            const ln = str.substring(username.length + 1)
            str = `<font class="username" color="${UI_THEME.base_font.color}">${this.sanitizeHTML(username)}:</font>` + this.sanitizeHTML(ln)
            return str
        }
        for(const message of list) {
            let message_lines = []
            const chunks = message.text.split('\n')
            let line = ' '.repeat(message.username.length) + ':'
            for(let i = 0; i < chunks.length; i++) {
                let c = chunks[i].split(' ')
                for(let w of c) {
                    if(w.length > COUNT_CHARS_IN_LINE) {
                        w = w.substring(0, COUNT_CHARS_IN_LINE - 3) + '...'
                    }
                    if(line.length + w.length >= COUNT_CHARS_IN_LINE - 1) {
                        if(message_lines.length == 0) {
                            line = replaceUsername(line, message.username)
                        } else {
                            line = this.sanitizeHTML(line)
                        }
                        message_lines.push(line)
                        line = ' '
                        if(w.length > COUNT_CHARS_IN_LINE - 2) {
                            w = w.substring(2)
                        }
                    }
                    line += ` ${w}`
                }
            }
            if(message_lines.length == 0) {
                message_lines.push(replaceUsername(line, message.username))
            } else {
                message_lines.push(this.sanitizeHTML(line))
            }
            message_lines.push('')
            message_lines = StringHelpers.applyMCStyles(message_lines.join('\n')).split('\n')
            lines.push(...message_lines)
        }
        lines.pop()
        return lines
    }

    drawHUD(hud : HUD) {

        const height = 260
        const width = 400
        const bottom = 170
        const margin = UI_THEME.window_padding * this.zoom

        //
        if (!this.chat_input) {
            this.init(hud)
            const w = width * this.zoom
            const h = height * this.zoom
            this.history_messages_window = new Window(0, hud.height - (height + bottom) * this.zoom, w, h, 'history_messages_window')
            this.history_messages_window.setBackground(this.hud_atlas.getSpriteFromMap('chat_background'))
            hud.hudwindow.add(this.history_messages_window)
            //
            const lblTop = new Label(0, 0, w, 2 * this.zoom, 'lblTop')
            lblTop.setBackground(this.hud_atlas.getSpriteFromMap('highlight_blue'))
            this.history_messages_window.addChild(lblTop)
            //
            const lblBottom = new Label(0, (height - 2) * this.zoom, w, 2 * this.zoom, 'lblBottom')
            lblBottom.setBackground(this.hud_atlas.getSpriteFromMap('highlight_blue'))
            this.history_messages_window.addChild(lblBottom)
            //
            const htmlText1 = this.htmlText1 = new HTMLText(margin, margin, w - margin * 2, h - margin * 2, '_wmhtmltext')
            htmlText1.htmlStyle.wordWrapWidth = w - margin * 2
            htmlText1.htmlStyle.loadFont('/style/UbuntuMono-Regular.ttf').then(() => {
                htmlText1.htmlStyle.fontFamily = UI_THEME.base_font.family
            })
            htmlText1.clip(0, 0, w - margin * 2, h - margin * 2)
            this.history_messages_window.addChild(htmlText1)
        }

        // Calc new position
        this.history_messages_window.y = hud.height - (height + bottom) * this.zoom

        // Change alpha
        this.chat_input.visible = this.active
        if (this.active) {
            this.draw(0, hud.height - bottom * this.zoom, width * this.zoom, this.line_height, margin)
            this.old_time = performance.now()
        } 
        const show_time = Qubatch.settings.chat_time * 1000 + 10
        const time = performance.now() - this.old_time
        const half_show_time = (show_time / 2)
        if (time >= show_time) {
            this.history_messages_window.visible = false
        } else if (time >= half_show_time) {
            const transparent_time = time - half_show_time
            if (transparent_time > 0) {
                this.history_messages_window.alpha = 1 - transparent_time / half_show_time
                this.htmlText1.alpha = this.history_messages_window.alpha
            }
        } else {
            this.history_messages_window.visible = true
            this.history_messages_window.alpha = 1
            this.htmlText1.alpha = this.history_messages_window.alpha
        }

        // Update text window
        if(this.messagesUpdateID != this.messages.updateID) {

            this.messagesUpdateID = this.messages.updateID

            let list = this.messages.list.slice(0)
            const reverse = Qubatch.settings.chat_reverse
            if(reverse) {
                list = list.reverse()
            }

            let all_lines = this.makeLines(list)

            this.#shift = Mth.clamp(this.#shift, 0, Math.max(all_lines.length - COUNT_LINES, 0))

            const lines = all_lines.slice(this.#shift, this.#shift + COUNT_LINES)

            let margin = 0
            if(lines.length > 0) {
                while(lines[0].indexOf('<font class="username"') !== 0) {
                    lines.unshift(all_lines[this.#shift + --margin])
                }
            }

            // Если обратный вывод сообщений, до дополняем до необходимого количества строк,
            // чтобы сообщения рисовались в нижней части окна сообщений
            if(reverse && lines.length < COUNT_LINES) {
                lines.unshift(...new Array(COUNT_LINES - lines.length).fill(''))
            }

            const htmlText = `<div style="word-wrap: break-word; margin-top: ${margin}em;">${lines.join('<br>')}</div>`
            this.htmlText1.text = htmlText

        }

    }

    sanitizeHTML(text : string) : string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/ /g, '&nbsp;').replace(/'/g, '&#039;').replace(/\r/g, '')
    }

    // Hook for keyboard input.
    onKeyEvent(e: KbEvent) {
        const { keyCode, down, first } = e;
        switch (keyCode) {
            case KEY.ARROW_UP:
            case KEY.ARROW_DOWN: {
                if (down) {
                    this.historyNavigate(keyCode == KEY.ARROW_UP);
                    return true;
                }
                break;
            }
            case KEY.ESC: {
                if (down) {
                    this.close();
                    // Qubatch.setupMousePointer(true);
                    return true;
                }
                break;
            }
            case KEY.BACKSPACE: {
                if (down) {
                    this.backspace();
                    break;
                }
                return true;
            }
            case KEY.DEL: {
                if (down) {
                    this.onKeyDel();
                    break;
                }
                return true;
            }
            case KEY.HOME: {
                if (down) {
                    this.onKeyHome();
                    break;
                }
                return true;
            }
            case KEY.END: {
                if (down) {
                    this.onKeyEnd();
                    break;
                }
                return true;
            }
            case KEY.ARROW_LEFT: {
                if (down) {
                    this.moveCarriage(-1);
                    break;
                }
                return true;
            }
            case KEY.ARROW_RIGHT: {
                if (down) {
                    this.moveCarriage(1);
                    break;
                }
                return true;
            }
        }
    }

    onPosChat() {
        if (Qubatch.settings.chat_reverse) {
            this.#shift = Number.MAX_VALUE
        } else {
            this.#shift = 0
        }
        this.messages.updateID++
    }

    onScroll(up: boolean) {
        this.#shift += (up ? 1 : -1) * 1
        this.messages.updateID++
    }

}