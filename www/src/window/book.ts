import { Button, Label, Window } from "../../tools/gui/wm.js";
import { SpriteAtlas } from "../core/sprite_atlas.js";
import { BlankWindow } from "./blank.js";

// кнопки перелистывания
class ActiveButton extends Window {
    [key: string]: any;

    constructor(x, y, sx, sy, id, icon, ct) {

        super(x, y, sx, sy, id, null, null);
        this.x *= this.zoom 
        this.y *= this.zoom
        this.w *= this.zoom
        this.h *= this.zoom
        this.ct = ct;
        this.style.border.hidden = true;
        this.style.background.image = './media/gui/book.png';
        this.style.background.color = '#00000000';

        /*
        // TODO: pixi
        this.style.background.sprite = {
            'mode': 'stretch',
            'width': 32,
            'height': 26,
            'x': 8,
            'y': 415
        };
        this.setBackground(this.style.background.image, 'sprite');
        this.setIcon(icon);
        this.setEnable(true);
        */

        this.onMouseEnter = function() {
            if (this.enable) {
                this.style.background.sprite.x = 54;
            }
        };

        this.onMouseLeave = function() {
            if (this.enable) {
                this.style.background.sprite.x = 8;
            }
        };

        this.onMouseDown = function() {
            if (this.enable) {
                if (this == this.ct.btn_back) {
                    this.ct.page--;
                } else {
                    this.ct.page++;
                }
                this.ct.btn_back.setEnable(this.ct.page > 0 ? true : false);
                this.ct.btn_next.setEnable(this.ct.page < this.ct.pages.length - 1 ? true : false);
            }
        };
    }

    setEnable(val) {
        this.enable = val;
        /*
        // TODO: pixi
        if (!this.enable) {
            this.style.background.sprite.x = 88;
        } else {
            this.style.background.sprite.x = 8;
        }
        */
    }

    setIcon(name) {
        /*
        // TODO: pixi
        switch(name) {
            case 'back': {
                this.style.background.sprite.x = 8;
                this.style.background.sprite.y = 415;
                break;
            }
            case 'next': {
                this.style.background.sprite.x = 8;
                this.style.background.sprite.y = 390;
                break;
            }
        }
        */
    }

}

export class BookWindow extends BlankWindow {
    [key: string]: any;

    constructor(player) {

        super(10, 10, 290, 360, 'frmBook', null, null)

        this.w *= this.zoom
        this.h *= this.zoom
        this.extra_data = null
        this.page = 0
        this.pages = []

        // Create sprite atlas
        this.atlas = new SpriteAtlas()
        this.atlas.fromFile('./media/gui/book.png').then(async atlas => {
            this.setBackground(await atlas.getSprite(40, 0, 290, 360), 'none', this.zoom / 2.0)
        })

        // Создание лебалов
        this.createLabels()

        // Создание кнопок
        this.createButtons()

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            const btnClose = new Button(ct.width - 20 * this.zoom, 5 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.border.hidden = true;
            btnClose.style.background.color = '#00000000';
            btnClose.style.background.image = image;
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                ct.hide();
            }
            ct.add(btnClose)
        })

    }

    // Обработчик открытия формы
    onShow(args) {
        super.onShow(args)
        this.page = 0
        this.pages = []
        this.btn_back.setEnable(false)
        this.btn_next.setEnable(false)
        if (args?.extra_data?.book) {
            this.page = args.extra_data.page
            this.pages = args.extra_data.book.pages
            this.btn_next.setEnable(true)
        }
        this.getRoot().center(this)
        Qubatch.releaseMousePointer()
    }

    createLabels(){
        this.lbl_pages = new Label(150 * this.zoom, 30 * this.zoom, 110 * this.zoom, 12 * this.zoom, 'lblPages', null, '');
        this.add(this.lbl_pages);
        this.lbl_text = new Label(25 * this.zoom, 50 * this.zoom, 240 * this.zoom, 270 * this.zoom, 'lblText', null, '');
        this.lbl_text.word_wrap = true;
        this.add(this.lbl_text);
    }

    createButtons() {
        this.btn_next = new ActiveButton(220 * this.zoom, 320 * this.zoom, 32 * this.zoom, 26 * this.zoom, 'btnNext', 'next', this);
        this.btn_back = new ActiveButton(40 * this.zoom, 320 * this.zoom, 32 * this.zoom, 26 * this.zoom, 'btnBack', 'back', this);
        this.btn_back.setEnable(false);
        this.add(this.btn_next);
        this.add(this.btn_back);
    }

    draw(ctx, ax, ay) {
        if (this.pages.length > 0) {
            this.lbl_pages.setText('Страница ' + (this.page + 1) + ' из ' + this.pages.length);
            this.lbl_text.setText(this.pages[this.page].text);
        }
        super.draw(ctx, ax, ay);
    }

}