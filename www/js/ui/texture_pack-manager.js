export class TexturePackManager {

    constructor($scope) {
        this.$scope = $scope;
            this.list = [
            {id: 'default', name: 'Default', value: 'terrain'},
            {id: 'hd', name: '32', value: 'terrain_hd'},
            {id: 'kenney', name: 'Kenney', value: 'terrain_kenney'},
            {id: '1px', name: '1px', value: 'terrain_1px'},
            {id: '128', name: '128', value: 'terrain_128'}
        ];
    }

    next() {
        let current = this.getCurrent();
        let index = 0;
        for(let i in this.list) {
            let tp = this.list[i];
            if(tp.value == current.value) {
                index = i;
                break;
            }
        }
        this.select(++index);
    }

    select(index) {
        index = index % this.list.length;
        this.$scope.settings.form.texture_pack = this.list[index].value;
    }

    getCurrent() {
        for(let tp of this.list) {
            if(tp.value == this.$scope.settings.form.texture_pack) {
                return tp;
            }
        }
    }

}