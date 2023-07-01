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
        this.#title.text = data.username
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
        const lblSeparator = new Label( this.w / 2 - 1.5 * this.zoom, 4.5 * this.line_height, 3 * this.zoom, this.h - 8 * this.line_height, 'lblSeparator', '', '')
        lblSeparator.style.border.hidden = true
        lblSeparator.style.background.color = '#00000033'
        this.add(lblSeparator)

        // Заголовок
        const lblName = new Label(2 * this.line_height, 2 * this.line_height, 0, 22 * this.zoom, 'lblName', '', 'World Name')
        lblName.style.font.size = 16
        lblName.style.font.weight = 'bold'
        this.add(lblName)

        // кнопка оффициальный
        const lblOfficial = new Label(286 * this.zoom, 2 * this.line_height, 0, 22 * this.zoom, 'lblOfficial', '', 'Official')
        lblOfficial.style.font.size = 16
        this.add(lblOfficial)

        const btnSwitchOfficial = new Label(this.w / 2 - 2 * this.line_height - 17 * this.zoom, 2 * this.line_height + 2 * this.zoom, 17 * this.zoom, 17 * this.zoom, 'btnSwitchOfficial')
        btnSwitchOfficial.setBackground(hud_atlas.getSpriteFromMap('check_bg'))
        btnSwitchOfficial.style.border.color = UI_THEME.button.border.disabled_color
        btnSwitchOfficial.style.border.style = 'fixed_single'
        btnSwitchOfficial.style.border.hidden = false
        this.add(btnSwitchOfficial)

        const lblPlayers = new Label(this.w / 2 + 2 * this.line_height, 2 * this.line_height, 0, 22 * this.zoom, 'lblPlayers', '', 'Players')
        lblPlayers.style.font.size = 16
        lblPlayers.style.font.weight = 'bold'
        this.add(lblPlayers)

        // предпросмотр
        const lblPreview = new Label(2 * this.line_height, lblName.y + lblName.h + 1.5 * this.line_height, 167 * this.zoom, 96 * this.zoom, 'lbl_preview', '', '')
        lblPreview.style.textAlign.horizontal = 'center'
        lblPreview.style.textAlign.vertical = 'middle'
        lblPreview.style.border.hidden = false
        lblPreview.setText(Lang.no_cover)
        this.add(lblPreview)

        // список
        let y = lblPreview.y + lblPreview.h + 2 * this.line_height
        for(const item of [
            {id: 'lblDateCreated', title: Lang.date_created},
            {id: 'lblAge', title: Lang.age},
            {id: 'lblCreator', title: Lang.creator}
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

        const btnSwitchPublic = new Label(this.w / 2 - 2 * this.line_height - 17 * this.zoom, 28 * this.line_height + 2 * this.zoom, 17 * this.zoom, 17 * this.zoom, 'btnSwitchPublic')
        btnSwitchPublic.style.border.color = UI_THEME.button.border.disabled_color
        btnSwitchPublic.style.border.style = 'fixed_single'
        btnSwitchPublic.style.border.hidden = false
        btnSwitchPublic.setBackground(hud_atlas.getSpriteFromMap('check_bg'))
        btnSwitchPublic.onMouseDown = function() {
            player.world.server.Send({
                name: ServerClient.CMD_WORLD_STATS, 
                data: {
                    public: btnSwitchPublic.toggled ? false : true
                }
            })
        }
        btnSwitchPublic.visible = false
        this.add(btnSwitchPublic)

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
            console.log(cmd)
            const data = cmd.data
            
            data.age = data.age.replace('h', Lang.short_hours)
            data.age = data.age.replace('d', Lang.short_days)
            data.age = data.age.replace('m', Lang.short_month)
            data.age = data.age.replace('y', Lang.short_year)
            
            setValue('lblName', data.title)
            setValue('lblCreator', data.username)
            setValue('lblDateCreated', this.timeToStr(data.time * 1000))
            setValue('lblAge', data.age)

            btnSwitchPublic.setIcon(data.public ? hud_atlas.getSpriteFromMap('check2') : null)
            btnSwitchPublic.toggled = data.public
            btnSwitchOfficial.setIcon(data.official ? hud_atlas.getSpriteFromMap('check2') : null)
            self.collection.initCollection(data.players)
            if (data?.cover) {
                lblPreview.style.border.hidden = true
                lblPreview.setText('')
                lblPreview.setBackground(`/worldcover/${data.guid}/screenshot/${data.cover}`)
            }
            if (data?.is_admin) {
                lbl_public.visible = true
                btnSwitchPublic.visible = true
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
        return ('0' + day.toString()).substr(-2) + '.' + ('0' + month.toString()).substr(-2) + '.' + date.getFullYear() + ' ' + ('0' + hours.toString()).substr(-2) + ':' + ('0' + minutes.toString()).substr(-2)
    }

}