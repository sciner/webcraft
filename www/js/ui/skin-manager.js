import {Helpers} from '../helpers.js';
import {Resources} from '../resources.js';

export class SkinManager {

    constructor($scope) {   
        // https://ru.namemc.com/minecraft-skins/trending/top?page=5
        this.$scope     = $scope;
        this.list       = [];
        this.index      = 0;
        this.loading    = true;
    }

    open() {
        this.$scope.current_window.show('skin');
    }
    
    close() {
        this.$scope.current_window.show('main');
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
        this.$scope.Game.skin = this.list[this.index];
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
        this.$scope.Game.skins = this;
        this.$scope.Game.skin = list[this.index];
    }

}