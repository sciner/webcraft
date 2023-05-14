import { BBModel_Preview } from './bbmodel_preview.js';

const SKIN_STORAGE_NAME = 'skin_id'

export class SkinManager {
    preview:            BBModel_Preview
    index:              int = 0
    loading:            boolean = true
    staticList:         any
    skin_preview_image: HTMLImageElement
    $timeout:           Function
    #controller : {
        App: any,
        current_window: any,
        Qubatch: any,
        $apply: any
    };

    constructor($scope : any, $timeout? : Function) {
        this.#controller    = $scope
        this.$timeout       = $timeout
        this.preview        = new BBModel_Preview()
        this.#controller.Qubatch.skins = this
    }

    load() : string {
        const skin_id = localStorage.getItem(SKIN_STORAGE_NAME)
        this.#controller.Qubatch.skin_id = skin_id
        return skin_id
    }

    save() {
        this.saveSkin(this.preview.current.id)
        this.#controller.Qubatch.skin_id = this.preview.current.id
        this.close()
    }

    saveSkin(skin_id: string) {
        localStorage.setItem(SKIN_STORAGE_NAME, skin_id)
    }

    // Init
    async init() {
        if((this.#controller as any).mygames.enterWorld.getWorldGuid()) {
            return
        }
        this.reloadSkins(async (list) => {
            if(this.preview.isActive) {
                const skin_id = this.load()
                // console.log(skin_id, list)
                await this.preview.init(list, this.$timeout)
                this.$timeout(() => {
                    this.preview.select(skin_id)
                }, 0, true)
            }
        })
    }

    stop() {
        this.preview.stop()
    }

    toggle() {
        this.#controller.current_window.toggle('skin')
    }

    close() {
        this.toggle()
    }

    prev() {
        this.preview.prev()
    }

    next() {
        this.preview.next()
    }

    reloadSkins(callback : Function) {
        if (!this.#controller.App.getSession()) {
            return;
        }
        this.#controller.App.GetSkins({}, (resp) => {
            callback(resp)
        });
    }

    onShow(args? : any) {
    }

    onHide(args? : any) {
    }

}