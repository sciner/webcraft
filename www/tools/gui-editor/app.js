globalThis.UI_ZOOM = 2

import { Window } from "../gui/wm.js"
import { Helpers } from "../../js/helpers.js"
import { initEditor } from "./init.js"

const {wm, selector} = await initEditor('wmCanvas')

// Отлов глобальных событий смены hover контрола
wm.rootMouseEnter = (el) => {
    const bounds = el.getBounds()
    selector.transform.position.set(bounds.x, bounds.y)
    selector.w = bounds.width
    selector.h = bounds.height
}

// прописываем стили "рабочему столу"
// wm.style.padding.set(10)
wm.style.background.color = '#008888'

// создание нового окна
const wnd = new Window(0, 0, 352 * UI_ZOOM, 332 * UI_ZOOM, 'wnd')
wm.add(wnd) // добавление его на "рабочий стол"
// wnd.style.background.color = '#cccccc' // цвет фона формы
wnd.setBackground('/media/gui/form-empty.png') // смена фона

// загрузка layout
const layout = await Helpers.fetchJSON('/data/layout/quest_view.json')
wnd.appendLayout(layout) // применение layout к форме 

// по умолчанию данный layout скрыт, поэтому запрашиваем его и делаем видимым
const ql = wnd.getWindow('questViewLayout') // запрашиваем контрол данной формы
ql.visible = true

// пример считывания текста
const lDesc = ql.getWindow('lDesc')
console.log(lDesc, lDesc.text)