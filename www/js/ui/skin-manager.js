import {Helpers} from '../helpers.js';
import {Resources} from '../resources.js';

export class SkinManager {

    #controller;

    constructor(controller, $timeout) {   
        // https://ru.namemc.com/minecraft-skins/trending/top?page=5
        this.#controller    = controller;
        this.$timeout       = $timeout;
        this.list           = [];
        this.index          = 0;
        this.loading        = true;
    }

    toggle() {
        this.#controller.current_window.toggle('skin');
    }

    close() {
        this.toggle();
    }

    next() {
        this.index++;
        if(this.index == this.list.length) {
            this.index = 0;
        }
    }

    prev() {
        this.index--;
        if(this.index < 0) {
            this.index = this.list.length - 1;
        }
    }

    save() {
        localStorage.setItem('skin', this.list[this.index].id);
        this.#controller.Qubatch.skin = this.list[this.index];
        this.close();
    }

    getById(skin_id) {
        for(let item of this.list) {
            if(item.id == skin_id) {
                return item;
            }
        }
        return this.list[0];
    }

    // Init
    async init() {
        let list = await Resources.loadSkins();
        this.list = list;
        let s = localStorage.getItem('skin');
        if(s) {
            for(let i in list) {
                if(list[i].id == s) {
                    this.index = parseInt(i);
                    break;
                }
            }
        }
        this.#controller.Qubatch.skins = this;
        this.#controller.Qubatch.skin = list[this.index];
    }

    //
    initProfilePage() {
        if(this.$timeout) {
            this.$timeout(() => {
                this.catchSlider(initProfilePage(this.index));
            });
        } else {
            this.catchSlider(initProfilePage(this.index));
        }
    }

    //
    catchSlider(slider) {
        slider.on('slideChanged', (e) => {
            this.index = e.track.details.abs;
        });
    }

}