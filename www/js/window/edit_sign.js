import {Button, Label, TextEdit, Window} from "../../tools/gui/wm.js";
import {ServerClient} from "../server_client.js";
import {Vector} from "../helpers.js";

export class EditSignWindow extends Window {

    constructor(x, y, w, h, id, title, text) {

        super(x, y, w, h, id, title, text);

        this.zoom *= 1.5;

        this.width *= this.zoom;
        this.height *= this.zoom;
        this.style.background.image_size_mode = 'stretch';

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/edit_sign_oak.png');
        ct.hide();

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.ESC: {
                    if(!down) {
                        ct.hide();
                    }
                    return true;
                }
            }
            return false;
        }

        // Обработчик закрытия формы
        //this.onHide = function() {
        //}

        // Add labels to window
        let lbl1 = new Label(135 * this.zoom, 12 * this.zoom, 80 * this.zoom, 30 * this.zoom, 'lbl1', null, 'Edit signature');
        // lbl1.style.font.size *= 1.5;
        ct.add(lbl1);

        // Text editors
        let margin          = (this.width / this.zoom) / 48 * 2;
        let textEditHeight  = margin * 6; // 100;
        const txtEdit1 = new TextEdit(margin * this.zoom, 40 * this.zoom, this.width - (margin * 2) * this.zoom, textEditHeight * this.zoom, 'txtEdit1', null, 'Hello, World!');
        txtEdit1.word_wrap = true;
        txtEdit1.style.font.size *= this.zoom;
        txtEdit1.focused = true;
        ct.add(txtEdit1);

        // Обработчик открытия формы
        this.onShow = (args) => {
            this.args = args;
            txtEdit1.buffer = [];
            Game.releaseMousePointer();
        }

        // Обработчик открытия формы
        this.onHide = () => {
            const pos = this.args.pos;
            const block = Game.world.getBlock(pos);
            if(block.material.tags.indexOf('sign') >= 0) {
                let extra_data = block.extra_data || {};
                extra_data.text = txtEdit1.buffer.join('');
                const e = {
                    pos: pos, // {x: pos.x, y: pos.y, z: pos.z, n: Vector.ZERO, point: Vector.ZERO},
                    createBlock: true,
                    destroyBlock: false,
                    cloneBlock: false,
                    start_time: performance.now(),
                    id: +new Date(),
                    shift_key: false,
                    button_id: MOUSE.BUTTON_RIGHT,
                    number: 1,
                    extra_data: extra_data
                    /*
                    actions: {
                        blocks: {
                            list: [
                                {
                                    pos: pos,
                                    item: {
                                        id: block.id,
                                        rotate: block.rotate,
                                        entity_id: block.entity_id,
                                        extra_data: extra_data
                                    },
                                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                                }
                            ]
                        }
                    }
                    */
                };
                // @server Отправляем на сервер инфу о взаимодействии с окружающим блоком
                Game.world.server.Send({
                    name: ServerClient.CMD_PICKAT_ACTION,
                    data: e
                });
            }
        }

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            const bs = 20; // margin * 1.5;
            let btnClose = new Button(ct.width - (margin + bs) * this.zoom, 9 * this.zoom, bs * this.zoom, bs * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image = image;
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                ct.hide();
            }
            btnClose.onMouseLeave = function() {
                this.style.background.color = '#c6c6c6';
                this.style.color = '#3f3f3f';
            }
            ct.add(btnClose);
        });

        // Save button
        const btnHeight = margin * 1.5;
        let btnSave = new Button(ct.width * .5 - 50 * this.zoom, this.height - (btnHeight + margin) * this.zoom, 100 * this.zoom, btnHeight * this.zoom, 'btnSave', 'Save');
        btnSave.onDrop = btnSave.onMouseDown = function(e) {
            ct.hide();
        }
        btnSave.onMouseLeave = function() {
            this.style.background.color = '#c6c6c6';
            this.style.color = '#3f3f3f';
        }
        ct.add(btnSave);

    }

}