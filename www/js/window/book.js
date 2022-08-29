import { Button, Label, Window } from "../../tools/gui/wm.js";
import { Lang } from "../lang.js";
import { Helpers } from "../helpers.js";

const CHAR_TO_PAGE = 700;

// кнопки перелистывания
class ActiveButton extends Window {
    
    constructor(x, y, sx, sy, id, icon, ct) {
        
        super(x, y, sx, sy, id, null, null);
        
        this.ct = ct;
        this.style.border.hidden = true;
        this.style.background.image = './media/gui/book.png';
        this.style.background.color = '#00000000';
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
                    this.ct.page_n--;
                } else {
                    this.ct.page_n++;
                }
                this.ct.btn_back.setEnable(this.ct.page_n > 0 ? true : false);
                this.ct.btn_next.setEnable(this.ct.page_n < this.ct.page_count - 1 ? true : false);
            }
        };
    }
    
    setEnable(val) {
        this.enable = val;
        if (!this.enable) {
            this.style.background.sprite.x = 88;
        } else {
            this.style.background.sprite.x = 8;
        }
    }
    
    setIcon(name) {
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
    }
    
}

export class BookWindow extends Window {

    constructor(player) {

        super(10, 10, 290, 360, "frmBook", null, null);

        this.width *= this.zoom;
        this.height *= this.zoom;

        // Get window by ID
        const ct = this;
        const options = {
            background: {
                image: './media/gui/book.png',
                image_size_mode: 'sprite',
                sprite: {
                    mode: 'stretch',
                    x: 40,
                    y: 0,
                    width: 290,
                    height: 360
                }
            }
        };
        this.style.background = {...this.style.background, ...options.background};
        this.style.background.color = '#00000000';
        this.style.border.hidden = true;
        this.setBackground(options.background.image);
        
        // Создание лебалов
        this.createLabels();
        
        // Создание кнопок
        this.createButtons();
        
        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Qubatch.releaseMousePointer();
        }

        // Обработчик закрытия формы
        this.onHide = function() {}

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
            ct.add(btnClose);
        });

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.ESC: {
                    if(!down) {
                        ct.hide();
                        try {
                            Qubatch.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    return true;
                }
            }
            return false;
        }
    }
    
    createLabels(){
        this.data = "Minecraft (от англ. mine — «шахта; добывать» + craft — «ремесло; создавать») — компьютерная инди-игра в жанре песочницы, созданная шведским программистом Маркусом Перссоном и выпущенная его компанией Mojang AB. Перссон опубликовал начальную версию игры в 2009 году; в конце 2011 года была выпущена стабильная версия для ПК Microsoft Windows, распространявшаяся через официальный сайт. В последующие годы Minecraft была портирована на Linux и macOS для персональных компьютеров; на Android, iOS и Windows Phone для мобильных устройств; на игровые приставки PlayStation 4, Vita, VR, Xbox One, Nintendo 3DS, Switch и Wii U. В 2014 году корпорация Microsoft приобрела права на Minecraft вместе с компанией Mojang AB за 2,5 миллиарда $. Студия 4J портировала игру на игровые приставки, а Xbox Game Studios разработала мультиплатформенную версию Minecraft и специальное издание игры для образовательных учреждений[⇨]. Перссон написал Minecraft на Java с использованием библиотеки графического вывода LWJGL, черпая идеи из таких игр, как Dwarf Fortress, Dungeon Keeper и Infiniminer  (англ.)рус.[⇨]. Minecraft даёт в распоряжение игрока процедурно генерируемый и изменяемый трёхмерный мир, полностью состоящий из кубов — его можно свободно перестраивать, создавая из этих кубов сложные сооружения — эта особенность делает игру схожей с различными конструкторами, такими как LEGO. Minecraft не ставит перед игроком каких-либо конкретных целей, но предлагает ему свободу действий: например, игрок может исследовать мир, добывать полезные ископаемые, сражаться с противниками и многое другое[⇨]";    
        this.page_count = Math.ceil(this.data.length / CHAR_TO_PAGE);
        this.page_n = 0;
        
        this.lbl_pages = new Label(150 * this.zoom, 30 * this.zoom, 110 * this.zoom, 12 * this.zoom, 'lblPages', null, '');
        this.lbl_pages.style.font.size = 11 * this.zoom;
        this.add(this.lbl_pages);
        
        this.lbl_text = new Label(25 * this.zoom, 50 * this.zoom, 240 * this.zoom, 270 * this.zoom, 'lblText', null, '');
        this.lbl_text.style.font.size = 12 * this.zoom;
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
    
    wrapText() {
        let end = (this.page_n + 1) * CHAR_TO_PAGE;
        let start = this.page_n * CHAR_TO_PAGE;
        let pos = this.data.indexOf(' ', end);
        end = (pos - end > 10 || pos == -1) ? end : pos;
        pos = this.data.indexOf(' ', start);
        start = (start - pos > 10 || pos == -1 || start == 0) ? start : pos;
        return this.data.substring(start, end);
    }
    
    draw(ctx, ax, ay) {
        this.lbl_pages.setText('Страница ' + (this.page_n + 1) + ' из ' + this.page_count);
        this.lbl_text.setText(this.wrapText());
        super.draw(ctx, ax, ay);
    }

}