import {BLOCK} from '../../js/blocks.js';
import { DIRECTION, Vector } from '../../js/helpers.js';
import {Renderer} from '../../js/render.js';
import {Resources} from '../../js/resources.js';

let app = angular.module('gameApp', []);

let injectParams = ['$scope', '$timeout'];
let gameCtrl = async function($scope, $timeout) {

    globalThis.controller = $scope;
    
    // BLOCK
    $scope.BLOCK = {};

    BLOCK.init({
        texture_pack: 'base',
        json_url: '../../data/block_style.json',
        resource_packs_url: '../../data/resource_packs.json'
    }).then(() => {
        $timeout(() => {
            //
            $scope.initRender();
            // Init blocks
            const B = $scope.BLOCK;
            B.max_id = BLOCK.max_id;
            B.all = BLOCK.getAll();
            B.used_slots = [];
            // styles
            const styles = new Map();
            const slots = new Map();
            const addTexture = (t, tx_cnt) => {
                const slot = new Vector(
                    Math.floor(t[0] * tx_cnt),
                    Math.floor(t[1] * tx_cnt),
                    0
                );
                slots.set(slot.toHash(), slot);
            };
            for(let i = 0; i < B.all.length; i++) {
                const b = B.all[i];
                let style = styles.get(b.style_name);
                if(!style) {
                    style = {
                        name: b.style_name,
                        count: 0,
                        list: []
                    };
                    styles.set(b.style_name, style);
                }
                //
                if(b.texture && ['base/regular/default', 'base/transparent/default', 'base/doubleface/default', 'base/doubleface_transparent/default'].indexOf(b.material_key) >= 0) {
                    for(let dir of [DIRECTION.UP, DIRECTION.DOWN, DIRECTION.LEFT, DIRECTION.RIGHT, DIRECTION.FORWARD, DIRECTION.BACK]) {
                        const t = BLOCK.calcTexture(b.texture, dir, b.tx_cnt);
                        addTexture(t, b.tx_cnt);
                    }
                    // mask_biome || mask_color
                    if(b.tags.includes('mask_biome') || b.tags.includes('mask_color')) {
                        for(let dir of [DIRECTION.UP, DIRECTION.DOWN, DIRECTION.LEFT, DIRECTION.RIGHT, DIRECTION.FORWARD, DIRECTION.BACK]) {
                            const t = BLOCK.calcTexture(b.texture, dir, b.tx_cnt);
                            addTexture([t[0] + (1 / b.tx_cnt), t[1]], b.tx_cnt);
                        }
                    }
                    // staged
                    if(b.stage_textures) {
                        for(let t of b.stage_textures) {
                            addTexture([t[0] / b.tx_cnt, t[1] / b.tx_cnt], b.tx_cnt);
                        }
                    }
                    // inventory.style
                    if(b.inventory?.texture) {
                        if(b.id == 618) {
                            console.log(b.name)
                        }
                        for(let dir of [DIRECTION.UP, DIRECTION.DOWN, DIRECTION.LEFT, DIRECTION.RIGHT, DIRECTION.FORWARD, DIRECTION.BACK]) {
                            const t = BLOCK.calcTexture(b.inventory.texture, dir, b.tx_cnt);
                            addTexture(t, b.tx_cnt);
                        }
                    }
                    // animated, but campfire like flames cannot be parsed from block =(
                    if(b.texture_animations) {
                        for(let item of [
                            {side: 'up', dir: DIRECTION.UP},
                            {side: 'down', dir: DIRECTION.DOWN},
                            {side: 'south', dir: DIRECTION.SOUTH},
                            {side: 'north', dir: DIRECTION.NORTH},
                            {side: 'east', dir: DIRECTION.EAST},
                            {side: 'west', dir: DIRECTION.WEST},
                        ]) {
                            const animations_side = BLOCK.getAnimations(b, item.side);
                            if(animations_side > 0) {
                                const t = BLOCK.calcTexture(b.texture, item.dir, b.tx_cnt);
                                for(let i = 0; i < animations_side; i++) {
                                    addTexture([t[0], t[1] + i / b.tx_cnt], b.tx_cnt);
                                }
                            }
                        }
                    }
                } else {
                    // inventory.style
                    if(b.inventory?.texture) {
                        if(b.inventory.texture?.id === 'default') {
                            if(b.id == 618) {
                                console.log(b.name)
                            }
                            for(let dir of [DIRECTION.UP, DIRECTION.DOWN, DIRECTION.LEFT, DIRECTION.RIGHT, DIRECTION.FORWARD, DIRECTION.BACK]) {
                                const t = BLOCK.calcTexture(b.inventory.texture, dir, b.tx_cnt);
                                addTexture(t, b.tx_cnt);
                            }
                        }
                    }
                }
                //
                style.count++;
                style.list.push(b);
            }
            B.styles = Array.from(styles.values());
            B.used_slots = slots;
            B.used_slots_array = Array.from(slots.values());
        });
    });

    // Init render
    $scope.initRender = async () => {
        /*
        var canvas = document.createElement('canvas');
        canvas.id = 'qubatchRenderSurface';
        document.getElementsByTagName('body')[0].appendChild(canvas);
        this.render = new Renderer('qubatchRenderSurface');
        await Resources.load({
            imageBitmap:    true,
            glsl:           this.render.renderBackend.kind === 'webgl',
            wgsl:           this.render.renderBackend.kind === 'webgpu'
        });
        await this.render.init({
            chunkManager: {
                setLightTexFormat: () => {}
            }
        }, {
            mipmap: true,
            render_distance: 5,
            texture_pack: 'base',
            use_light: true
        });
        this.render.generatePrev(() => {
            this.render.downloadInventoryImage();
        });
        */
    };

    // sprites
    $scope.new_sprites = {
        list: new Map(),
        block_code: '',
        array: [],
        add: function(image, filename, x, y) {
            if($scope.BLOCK.used_slots.has(new Vector(x, y, 0).toHash())) {
                alert('Slot used, cannot be rewrite');
                return false;
            }
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
            for(let item of this.list.values()) {
                this.array.push(item);
            }
            $timeout(() => {});
        },
        apply: function() {
            const blocks_json = [];
            // 1.
            for(let item of this.list.values()) {
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