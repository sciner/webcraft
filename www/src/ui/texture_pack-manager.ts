import { Resources } from "../resources.js";

export class TexturePackManager {
    [key: string]: any;

    constructor($scope) {
        this.$scope = $scope;
    }

    async init() {
        const resource_packs = await Resources.loadResourcePacks();
        this.list = [...resource_packs.variants];
        // Prepend default resource-pack option
        this.list.unshift({"id": "base", "name": "Base"});
        this.set(this.getCurrent());
        return this;
    }

    next() {
        let current = this.getCurrent();
        let index = 0;
        for(let i in this.list) {
            let tp = this.list[i];
            if(tp.id == current.id) {
                index = i;
                break;
            }
        }
        this.select(++index);
    }

    select(index) {
        index = index % this.list.length;
        this.$scope.settings.form.texture_pack = this.list[index].id;
        this.current = this.getCurrent();
    }

    set(item) {
        for(let i in this.list) {
            let tp = this.list[i];
            if(tp.id == item.id) {
                this.select(i);
            }
        }
    }

    getCurrent() {
        for(let tp of this.list) {
            if(tp.id == this.$scope.settings.form.texture_pack) {
                return tp;
            }
        }
    }

}