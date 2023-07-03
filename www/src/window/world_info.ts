import { Button, Label, Slider, Window } from "../ui/wm.js";
import { ServerClient } from "../server_client.js";
import { Lang } from "../lang.js";
import { INGAME_MAIN_HEIGHT, INGAME_MAIN_WIDTH, INVENTORY_SLOT_SIZE, UI_THEME } from "../constant.js";
import { BlankWindow } from "./blank.js";
import { Resources } from "../resources.js";

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
        if (data.is_me) {
            this.#title.setText(`[You]${data.username}`)
            this.#title.style.font.color = '#00ff00bb'
            this.btnTest.visible = false
        } else if (data.is_admin) {
            this.#title.setText(`[Admin]${data.username}`)
            this.#title.style.font.color = '#ff0000bb'
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

        const btn_switch_official = new Label(this.w / 2 - 2 * this.line_height - 17 * this.zoom, 2 * this.line_height + 2 * this.zoom, 17 * this.zoom, 17 * this.zoom, 'btn_switch_official')
        btn_switch_official.setBackground(hud_atlas.getSpriteFromMap('check_bg'))
        btn_switch_official.style.border.color = UI_THEME.button.border.disabled_color
        btn_switch_official.style.border.style = 'fixed_single'
        btn_switch_official.style.border.hidden = false
        this.add(btn_switch_official)

        const lbl_players = new Label(this.w / 2 + 2 * this.line_height, 2 * this.line_height, 0, 22 * this.zoom, 'lbl_players', '', Lang.players)
        lbl_players.style.font.size = 16
        lbl_players.style.font.weight = 'bold'
        this.add(lbl_players)

        // предпросмотр
        const lbl_preview = new Label(2 * this.line_height, lbl_name.y + lbl_name.h + 1.5 * this.line_height, 167 * this.zoom, 96 * this.zoom, 'lbl_preview', '', '')
        lbl_preview.style.textAlign.horizontal = 'center'
        lbl_preview.style.textAlign.vertical = 'middle'
        lbl_preview.setBackground(hud_atlas.getSpriteFromMap('cover_back'))
        lbl_preview.setText(Lang.no_cover)
        this.add(lbl_preview)

        // список
        let y = lbl_preview.y + lbl_preview.h + 2 * this.line_height
        for(const item of [
            {id: 'lbl_date_created', title: Lang.date_created},
            {id: 'lbl_age', title: Lang.age},
            {id: 'lbl_creator', title: Lang.creator}
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
        lbl_public.visible = false
        this.add(lbl_public)

        const btn_switch_public = new Label(this.w / 2 - 2 * this.line_height - 17 * this.zoom, 28 * this.line_height + 2 * this.zoom, 17 * this.zoom, 17 * this.zoom, 'btn_switch_public')
        btn_switch_public.style.border.color = UI_THEME.button.border.disabled_color
        btn_switch_public.style.border.style = 'fixed_single'
        btn_switch_public.style.border.hidden = false
        btn_switch_public.setBackground(hud_atlas.getSpriteFromMap('check_bg'))
        btn_switch_public.onMouseDown = function() {
            player.world.server.Send({
                name: ServerClient.CMD_WORLD_STATS, 
                data: {
                    public: btn_switch_public.toggled ? false : true
                }
            })
        }
        btn_switch_public.visible = false
        this.add(btn_switch_public)

        const lbl_public_description = new Label(2 * this.line_height, 30 * this.line_height, 0, 0, 'lbl_public_description', '', Lang.make_public_description)
        lbl_public_description.style.font.size = 10
        lbl_public_description.style.font.color = UI_THEME.second_text_color
        lbl_public_description.visible = false
        this.add(lbl_public_description)

        const lbl_public_description_2 = new Label(2 * this.line_height, 31 * this.line_height, 0, 0, 'lbl_public_description', '', Lang.make_public_description_2)
        lbl_public_description_2.style.font.size = 10
        lbl_public_description_2.style.font.color = UI_THEME.second_text_color
        lbl_public_description_2.visible = false
        this.add(lbl_public_description_2)

        //
        const setValue = (id : string, value : string) => {
            for(const w of this.list.values()) {
                if(w.id == id) {
                    w.text = value
                }
            }
        }

        this.addCollection()

        //
        const self = this
        player.world.server.AddCmdListener([ServerClient.CMD_WORLD_STATS], (cmd) => {

            const data = cmd.data
            
            data.age = data.age.replace('h', Lang.short_hours)
            data.age = data.age.replace('d', Lang.short_days)
            data.age = data.age.replace('m', Lang.short_month)
            data.age = data.age.replace('y', Lang.short_year)
            
            setValue('lbl_name', data.title)
            setValue('lbl_creator', data.username)
            setValue('lbl_date_created', this.timeToStr(data.time * 1000))
            setValue('lbl_age', data.age)

            btn_switch_public.setIcon(data.public ? hud_atlas.getSpriteFromMap('check2') : null)
            btn_switch_public.toggled = data.public
            btn_switch_official.setIcon(data.official ? hud_atlas.getSpriteFromMap('check2') : null)
            self.collection.initCollection(data.players)
            if (data?.cover) {
                lbl_preview.style.border.hidden = true
                lbl_preview.setText('')
                lbl_preview.setIcon(`/worldcover/${data.guid}/screenshot/${data.cover}`, 'centerstretch', .95)
            }
            if (data?.is_admin) {
                lbl_public.visible = true
                btn_switch_public.visible = true
                lbl_public_description.visible = true
                lbl_public_description_2.visible = true
            }
        })

    }

    // Обработчик открытия формы
    onShow(args) {
        this.player.world.server.Send({name: ServerClient.CMD_WORLD_STATS})
        super.onShow(args)
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
        return ('0' + day.toString()).substring(-2) + '.' + ('0' + month.toString()).substring(-2) + '.' + date.getFullYear() + ' ' + ('0' + hours.toString()).substring(-2) + ':' + ('0' + minutes.toString()).substring(-2)
    }

}