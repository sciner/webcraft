import { Resources } from "../resources.js";

export class TexturePackManager {

    constructor($scope) {
        this.$scope = $scope;
    }

    async init() {
        const resource_packs = await Resources.loadResourcePacks();
        this.list = [...resource_packs.variants];
        // Prepend default resource-pack option
        this.list.unshift({"id": "base", "name": "Base"});
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
    }

    getCurrent() {
        for(let tp of this.list) {
            if(tp.id == this.$scope.settings.form.texture_pack) {
                return tp;
            }
        }
    }

}