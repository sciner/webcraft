globalThis.UI_ZOOM = 1
import {WindowManager, Window, Label, Button} from "./wm+pixi.js"

// Define canvas and drawing context
let canvas = document.getElementById('canvas');

// Init Window Manager
const wm = new WindowManager(canvas, 0, 0, canvas.width, canvas.height)
wm.setBackground('./screenshot.jpg')
wm.style.background.color = '#00000044'

// Создаем форму
wm.add(new Window(10, 10, 352, 332, 'ct1', null));

// Получаем форму по её идентификатору
const ct = wm.getWindow('ct1')
// Устанавливаем фоновое изображение
ct.setBackground('/media/gui/form-crafting-table.png');
ct.style.background.color = '#00000000';
ct.style.background.image_size_mode = 'stretch'
ct.style.border.hidden = true;

// Добавляем надписи на форму
let lbl1 = new Label(59, 12, 250, 20, 'lbl1', null, 'Crafting');
ct.add(lbl1);

// Добавление второй надписи
let lbl2 = new Label(16, 144, 150, 20, 'lbl2', null, 'Inventory');
lbl2.style.background.color = '#ffffff33';
lbl2.onMouseMove = function(e) {
    this.setText(e.x + 'x' + e.y);
}
ct.add(lbl2);

// Создание слотов для инвентаря
ct.inventory_slots = new Array(27);
let sx = 14;
let sy = 166;
let sz = 36;
let xcnt = 9;
for(let i = 0; i < ct.inventory_slots.length; i++) {
    let lblSlot = new Label(sx + (i % xcnt) * sz, sy + Math.floor(i / xcnt) * 36, sz, sz, 'lblSlot' + i, null, '' + i);
    lblSlot.onMouseEnter = function() {
        this.style.background.color = '#ffffff33';
        wm.clear();
        wm.draw();
    }
    lblSlot.onMouseLeave = function() {
        this.style.background.color = '#00000000';
        wm.clear();
        wm.draw();
    }
    ct.add(lblSlot);
}

// Кнопка рецептов
let btnRecipes = new Button(10, 68, 40, 36, 'btnRecipes', null);
btnRecipes.setBackground('/media/gui/recipes.png');
btnRecipes.onMouseDown = function(e) {
    alert('Привет');
}
/*
// Пример того, как можно сохранить оригинальные обработчики, чтобы их можно было все таки вызвать после переназначения
btnRecipes.onMouseEnter2 = btnRecipes.onMouseEnter;
btnRecipes.onMouseLeave2 = btnRecipes.onMouseLeave;
btnRecipes.onMouseEnter = function() {
    this.onMouseEnter2();
}
btnRecipes.onMouseLeave = function() {
    this.onMouseLeave2();
}
*/
ct.add(btnRecipes);

// Добавляем кнопку на форму
let btnClose = new Button(ct.width - 40, 20, 20, 20, 'btnClose', '×');
btnClose.onMouseEnter = function() {
    this.style.background.color = '#ff000033';
}
btnClose.onMouseLeave = function() {
    this.style.background.color = '#00000000';
}
btnClose.onMouseDown = function(e) {
    console.log('mousedown');
    this.style.background.color = '#00000000';
    ct.hide();
}
ct.add(btnClose);

// Центруем форму внутри родителя
wm.center(ct);

// Draw all
wm.clear();
wm.draw();

// ПРИМЕРЫ:
const demo = {
    // Скрыть / показать форму
    toggleVisibility: function() {
        let ct1 = wm.getWindow('ct1');
        ct1.toggleVisibility();
        // После ручного изменения любого состояния необходимо вызвать перерисовку
        wm.clear();
        wm.draw();
    },
    // Поменять текст надписи в указанной форме
    changeLabelText: function() {
        let ct1 = wm.getWindow('ct1');
        ct1.getWindow('lbl1').setText((new Date()).toLocaleString());
        // После ручного изменения любого состояния необходимо вызвать перерисовку
        wm.clear();
        wm.draw();
    }
};

globalThis.demo = demo
globalThis.Qubatch = {
    hud: {wm}
}

canvas.addEventListener('mousemove', function(e) {
    wm.mouseEventDispatcher(e);
    wm.clear();
    wm.draw();
});

canvas.addEventListener('mousedown', function(e) {
    wm.mouseEventDispatcher(e);
    wm.clear();
    wm.draw();
});