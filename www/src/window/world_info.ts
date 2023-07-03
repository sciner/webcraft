import { Button, CheckBox, Label, Slider, Window } from "../ui/wm.js";
import { Lang } from "../lang.js";
import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH,  UI_THEME } from "../constant.js";
import { BlankWindow } from "./blank.js";
import { Resources } from "../resources.js";
import type { World } from "../world.js";
import type { Player } from "player.js";

class PlayerItem extends Window {
    #data: any
    #parent: Window
    #title = null
    #id = null

    constructor(x : number, y : number, w : number, h : number, id : string, parent: Window) {
        super(x, y, w, h, id, null, null)
        this.#parent = parent
        this.#title = new Label(0, 0, 0, 0, 'lblTitle', '', '')
        this.#title.style.font.size = 16
        this.#title.style.font.color = UI_THEME.second_text_color
        this.add(this.#title)
        this.btnTest = new Button(w - 50 * this.zoom, 0, 50 * this.zoom, h - 2 * this.zoom, 'btnTest', 'button')
        this.add(this.btnTest)
    }

    setPlayer(data) {
        this.#id = data.id
        this.#title.setText(data.username)
        this.#title.style.font.color = UI_THEME.second_text_color
        if (data.its_me) {
            this.#title.setText(`[${Lang.is_you}] ${data.username}`)
            this.#title.style.font.color = '#009622ff'
            this.btnTest.visible = false
        } else if (data.is_admin) {
            this.#title.setText(`[${Lang.is_admin}] ${data.username}`)
            this.#title.style.font.color = '#c22727ff'
        }
    }
}

class PlayerCollection extends Window {
    private items : PlayerItem[] = []
    #parent: Window = null
    private items_count : int = 0
    private item_height : float = 0
    private line_height : float = 0
    private max_count : int = 0

    //
    constructor(x : int, y : int, w : int, h : int, id : string, parent: Window) {

        super(x, y, w, h, id)

        // настройки
        this.item_height = 22 * this.zoom
        this.line_height = 5 * this.zoom
        this.mul_scroll  = 10

        this.#parent     = parent
        this.max_count   = Math.floor(this.h / (this.item_height + this.line_height))
        this.style.border.hidden    = true

        this.container = new Window(0, 0, this.w - 22 * this.zoom, this.h, this.id + '_container')
        this.add(this.container)

        this.scrollbar = new Slider((this.w - 22 * this.zoom), 0, 22 * this.zoom, this.h, '_scroll')
        this.scrollbar.onScroll = (value) => {
            this.updateScroll(-value)
        }
        this.add(this.scrollbar)
    }

    _wheel(e) {
        this.scrollY += Math.sign(e.original_event.wheelDeltaY)
        this.scrollY = Math.min(this.scrollY, 0)
        this.scrollY = Math.max(this.scrollY, -Math.max(this.items_count - this.max_count, 0))
        this.container.y = this.scrollY * (this.line_height + this.item_height)
        this.scrollbar.value = -this.scrollY * this.mul_scroll
        this.updateVisibleItems()
    }

    updateScroll(val: number) {
        this.scrollY = Math.floor(val / this.mul_scroll)
        this.container.y = this.scrollY * (this.line_height + this.item_height)
        this.updateVisibleItems()
    }

    updateVisibleItems() {
        const start_index = Math.round(-this.scrollY)
        const end_index   = start_index + this.max_count
        for(let i = 0; i < this.items_count; i++) {
            const child = this.items[i]
            child.visible = i >= start_index && i < end_index
        }
    }

    // Init collection
    initCollection(all_items) {
        this.items_count = all_items.length
        if (this.items_count < this.items.length) {
            for (let i = 0; i < this.items.length; i++) {
                this.container.removeChild(this.items[i])
                this.items[i] = null
            }
        }
        let sy = this.line_height
        for(let i = 0; i < this.items_count; i++) {
            let item = this.items[i]
            if(!item) {
                item = this.items[i] = new PlayerItem(0, 0, this.w - 30 * this.zoom, this.item_height, 'lblItem' + (i), this.#parent)
                this.container.add(item)
            }
            item.y = sy
            item.setPlayer(all_items[i])
            sy += (this.line_height + this.item_height)
        }
        //this.scrollY = 0
        //this.container.h = this.h
        this.scrollbar.max = this.mul_scroll * (this.items_count - this.max_count)
        this.updateVisibleItems()
    }
}

export class WorldInfoWindow extends BlankWindow {

    private collection: PlayerCollection
    private player: any

    constructor(player) {

        super(0, 0, INGAME_MAIN_WIDTH, INGAME_MAIN_HEIGHT, "frmWorldInfo", '', '')
        this.h -= 44 // шапка
        this.w *= this.zoom
        this.h *= this.zoom

        this.player = player
        this.line_height = 14 * this.zoom
        const hud_atlas = Resources.atlas.get('hud')

        // разделитель
        const lbl_separator = new Label( this.w / 2 - 1.5 * this.zoom, 4.5 * this.line_height, 3 * this.zoom, this.h - 8 * this.line_height, 'lbl_separator', '', '')
        lbl_separator.style.border.hidden = true
        lbl_separator.style.background.color = '#00000033'
        this.add(lbl_separator)

        // Заголовок
        const lbl_name = new Label(2 * this.line_height, 2 * this.line_height, 0, 22 * this.zoom, 'lbl_name', '', 'World Name')
        lbl_name.style.font.size = 16
        lbl_name.style.font.weight = 'bold'
        this.add(lbl_name)

        // кнопка оффициальный
        const lbl_official = new Label(230 * this.zoom, 2 * this.line_height, 0, 22 * this.zoom, 'lbl_official', '', Lang.official)
        lbl_official.style.font.size = 16
        this.add(lbl_official)

        const chk_official = new CheckBox(this.w / 2 - 2 * this.line_height - 17 * this.zoom, 2 * this.line_height + 2 * this.zoom, 17 * this.zoom, 17 * this.zoom, 'btn_switch_official')
        chk_official.setBackground(hud_atlas.getSpriteFromMap('check_bg'))
        this.add(chk_official)

        const lbl_players = new Label(this.w / 2 + 2 * this.line_height, 2 * this.line_height, 0, 22 * this.zoom, 'lbl_players', '', Lang.players)
        lbl_players.style.font.size = 16
        lbl_players.style.font.weight = 'bold'
        this.add(lbl_players)

        // предпросмотр
        const lbl_preview = new Label(2 * this.line_height, lbl_name.y + lbl_name.h + 1.5 * this.line_height, 167 * this.zoom, 96 * this.zoom, 'lbl_preview', '', '')
        lbl_preview.style.textAlign.horizontal = 'center'
        lbl_preview.style.textAlign.vertical = 'middle'
        lbl_preview.setBackground(hud_atlas.getSpriteFromMap('cover_back'), 'centerstretch', 1.04)
        lbl_preview.setText(Lang.no_cover)
        this.add(lbl_preview)

        // список
        let y = lbl_preview.y + lbl_preview.h + 2 * this.line_height
        for(const item of [
            {id: 'lbl_date_created', title: Lang.date_created},
            {id: 'lbl_gamemode', title: Lang.world_game_mode},
            {id: 'lbl_age', title: Lang.age},
            {id: 'lbl_creator', title: Lang.creator},
            {id: 'lbl_generator', title: Lang.world_generator_type},
        ]) {
            const lbl_title = new Label(2 * this.line_height, y, 0, 0, item.id + '_title', item.title, item.title)
            const lbl = new Label(this.w / 2 - 2 * this.line_height, y, 0, 0, item.id, item.title, item.title)
            lbl_title.style.font.size = UI_THEME.base_font.size
            lbl_title.style.font.weight = 'bold'
            lbl_title.style.font.color = UI_THEME.base_font.color
            lbl.style.textAlign.horizontal = 'right'
            lbl.style.font.size = UI_THEME.base_font.size
            lbl.style.font.color = UI_THEME.second_text_color
            this.add(lbl_title)
            this.add(lbl)
            y += 2 * this.line_height
        }

        const lbl_public = new Label(2 * this.line_height, 28 * this.line_height, 0, 0, 'lbl_public', '', Lang.make_public)
        lbl_public.style.font.size = UI_THEME.base_font.size
        lbl_public.style.font.weight = 'bold'
        lbl_public.style.font.color = UI_THEME.base_font.color
        this.add(lbl_public)

        const chk_public = new CheckBox(this.w / 2 - 2 * this.line_height - 17 * this.zoom, 28 * this.line_height + 2 * this.zoom, 17 * this.zoom, 17 * this.zoom, 'btn_switch_public')
        chk_public.setBackground(hud_atlas.getSpriteFromMap('check_bg'))
        chk_public.visible = false
        this.add(chk_public)

        const lbl_public_description = new Label(2 * this.line_height, 30 * this.line_height, 0, 0, 'lbl_public_description', '', Lang.make_public_description)
        lbl_public_description.style.font.size = 10
        lbl_public_description.style.font.color = UI_THEME.second_text_color
        this.add(lbl_public_description)

        const lbl_public_description_2 = new Label(2 * this.line_height, 31 * this.line_height, 0, 0, 'lbl_public_description_2', '', Lang.make_public_description_2)
        lbl_public_description_2.style.font.size = 10
        lbl_public_description_2.style.font.color = UI_THEME.second_text_color
        this.add(lbl_public_description_2)

        this.addCollection()

    }

    // Обработчик открытия формы
    onShow(args) {
        super.onShow(args)
        this.updateInfo()
    }

    updateInfo() {

        const player : Player = this.player
        const world : World = this.player.world
        const info : TWorldInfo = world.info
        const time = world.getTime()

        //
        const setWindowText = (id : string, value : string) => {
            this.getWindow(id).text = value
        }

        //
        const self = this
        const hud_atlas = Resources.atlas.get('hud')
        const btn_switch_public = this.getWindow('btn_switch_public')
        const btn_switch_official = this.getWindow('btn_switch_official')
        const lbl_preview = this.getWindow('lbl_preview')
        const data = {
            guid:        info.guid,
            title:       (info.title.length > 17) ? info.title.substring(0, 17) + '...' : info.title,
            gamemode:    Lang[`gamemode_${info.game_mode}`],
            generator:   info.generator,
            cover:       `/worldcover/${info.guid}/screenshot/preview_${info.cover}`,
            username:    info.username,
            is_admin:    info.user_id == player.session.user_id,
            time:        info.dt,
            age:         time.string_full,
            is_public:   false,
            is_official: true,
            players:     [],
        }
        // fill players
        for(const p of world.players.values()) {
            data.players.push({
                id:       p.id, 
                username: p.username, 
                is_admin: p.id == info.user_id,
                its_me:   p.itsMe()
            });
        }
        
        data.age = data.age.replace('h', Lang.short_hours)
        data.age = data.age.replace('d', Lang.short_days)
        data.age = data.age.replace('m', Lang.short_month)
        data.age = data.age.replace('y', Lang.short_year)
        
        setWindowText('lbl_name', data.title)
        setWindowText('lbl_creator', data.username)
        setWindowText('lbl_date_created', this.timeToStr(data.time * 1000))
        setWindowText('lbl_age', data.age)
        setWindowText('lbl_gamemode', data.gamemode)
        setWindowText('lbl_generator', data.generator.id)

        btn_switch_public.setIcon(data.is_public ? hud_atlas.getSpriteFromMap('check2') : null)
        btn_switch_public.toggled = data.is_public
        btn_switch_official.setIcon(data.is_official ? hud_atlas.getSpriteFromMap('check2') : null)

        // players
        self.collection.initCollection(data.players)

        // cover
        if (data?.cover) {
            lbl_preview.style.border.hidden = true
            lbl_preview.setText('')
            lbl_preview.setIcon(data.cover, 'centerstretch', 1.0)
        }

        // is admin
        const lbl_public = this.getWindow('lbl_public')
        const lbl_public_description = this.getWindow('lbl_public_description')
        const lbl_public_description_2 = this.getWindow('lbl_public_description_2')
        for(let w of [lbl_public, btn_switch_public, lbl_public_description, lbl_public_description_2]) {
            w.visible = data.is_admin
        }

    }

    addCollection() {
        if(this.collection) {
            console.error('error_create_collection_players_already_created')
            return
        }
        this.collection = new PlayerCollection(this.w / 2 + 2 * this.line_height, 4.5 * this.line_height, this.w / 2 - 4 * this.line_height, this.h - 8 * this.line_height, 'wCollectionPlayers', this)
        this.add(this.collection)
    }

    timeToStr(time: number): string {
        const date = new Date(time)
        const month = date.getMonth() + 1
        const day = date.getDate()
        const hours = date.getHours()
        const minutes = date.getMinutes()
        return ('0' + day.toString()).substr(-2) + '.' + ('0' + month.toString()).substr(-2) + '.' + date.getFullYear() + ' ' + ('0' + hours.toString()).substr(-2) + ':' + ('0' + minutes.toString()).substr(-2)
    }

}