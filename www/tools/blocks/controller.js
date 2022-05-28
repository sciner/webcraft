// import {Vector, Helpers} from '../helpers.js';

let app = angular.module('gameApp', []);

let injectParams = ['$scope', '$timeout'];
let gameCtrl = async function($scope, $timeout) {

    globalThis.controller = $scope;

    // sprites
    $scope.new_sprites = {
        list: new Map(),
        block_code: '',
        array: [],
        add: function(image, filename, x, y) {
            this.list.set(filename, {image, filename, x, y});
            image.style.left = (x * SPRITE_SIZE) + 'px';
            image.style.top = (y * SPRITE_SIZE) + 'px';
            image.classList.add('img-sprite');
            dropZone.appendChild(image);
            this.refresh();
        },
        delete: function(item) {
            if(this.list.has(item.filename)) {
                this.delete(this.list.get(item.filename));
            }
            this.list.delete(item.filename);
            item.image.remove();
            this.refresh();
        },
        hover: function(item) {
            hover.style.left = item.x * SPRITE_SIZE + 'px';
            hover.style.top = item.y * SPRITE_SIZE + 'px';
        },
        refresh: function() {
            this.array = [];
            for(let [_, item] of this.list.entries()) {
                this.array.push(item);
            }
            $timeout(() => {});
        },
        apply: function() {
            const blocks_json = [];
            // 1.
            for(let [_, item] of this.list.entries()) {
                ctx.drawImage(item.image, item.x * SPRITE_SIZE, item.y * SPRITE_SIZE);
                blocks_json.push(
                    {
                        "id": null,
                        "name": item.filename.toUpperCase(),
                        "style": "extruder",
                        "texture": [item.x, item.y],
                        "material": {
                            "id": null
                        }
                    }
                );
            }
            inventory.toBlob(
                function(blob) {
                    let filefromblob = new File([blob], 'image.png', {type: 'image/png'});
                    downloadBlobPNG(filefromblob);
                }, 'image/png'
            );
            // 2.
            this.block_code = JSON.stringify(blocks_json, null, 4);
            //
            this.list.clear();
            this.refresh();
        }
    };

}

gameCtrl.$inject = injectParams;
app.controller('gameCtrl', gameCtrl);