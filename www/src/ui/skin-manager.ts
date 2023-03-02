import {Resources} from '../resources.js';
import {CLIENT_SKIN_ROOT} from '../constant.js';
import { skinview3d } from "../../vendors/skinview3d.bundle.js"

export class SkinManager {
    [key: string]: any;

    #controller : {
        App: any,
        current_window: any,
        Qubatch: any,
        $apply: any
    };

    constructor($scope : any, $timeout? : Function) {
        // https://ru.namemc.com/minecraft-skins/trending/top?page=5
        this.#controller    = $scope;
        this.$timeout       = $timeout;
        this.list           = [];
        this.index          = 0;
        this.loading        = true;
        this.newSkinSlim    = false;
        this.newSkinDataURL = '';
        this.newSkinFileName = '';
        this.currentSkinIsOwned = false;
        // if it's not null, it'll be used once to set index, and then set to null again
        this.restoreSkinIndex  = null;
    }

    initSkinView3d(id? : string) {
        this.skinViewer = this._initSkinView3d(id ?? 'skin_container');
    }

    initPreviewSkinView3d() {
        this.previewSkinViewer = this._initSkinView3d('preview_skin_container')
    }

    _initSkinView3d(id : string) {
        const skinViewer = new skinview3d.SkinViewer({
            canvas: document.getElementById(id),
            width: 300,
            height: 300,
            animation: new skinview3d.WalkingAnimation() // IdleAnimation WalkingAnimation RunningAnimation FlyingAnimation
        });
        skinViewer.camera.rotation.x = -0.620;
        skinViewer.camera.rotation.y = 0.534;
        skinViewer.camera.rotation.z = 0.348;
        skinViewer.camera.position.x = 30.5;
        skinViewer.camera.position.y = 22.0;
        skinViewer.camera.position.z = 42.0;
        skinViewer.zoom = 1
        return skinViewer;
    }

    get currentSkin() {
        return this.list[this.index];
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
        this.onCurrentSkinChange();
    }

    prev() {
        this.index--;
        if(this.index < 0) {
            this.index = this.list.length - 1;
        }
        this.onCurrentSkinChange();
    }

    saveSkinId(skin_id) {
        localStorage.setItem('skin', skin_id);
    }

    save() {
        const currentSkin = this.currentSkin;
        this.saveSkinId(currentSkin.id);
        this.#controller.Qubatch.skin = currentSkin;
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

    findSkinIndex() {
        let s = localStorage.getItem('skin');
        if (this.restoreSkinIndex != null) {
            this.index = this.restoreSkinIndex;
            this.restoreSkinIndex = null;
            s = null;
        }
        this.index = Math.min(this.index, this.list.length - 1);
        if(s) {
            for(let i in this.list) {
                if(this.list[i].id == s) {
                    this.index = parseInt(i);
                    break;
                }
            }
        }
        this.onCurrentSkinChange();
    }

    onCurrentSkinChange() {
        // this.#controller.$apply(() => {
            if(this.skinViewer) {
                const model = this.currentSkin.type ? 'slim' : 'default';
                this.skinViewer.loadSkin(this.currentSkin.file, {model})
            }
            this.currentSkinIsOwned = this.currentSkin?.owned || false;
        // });
    }

    reloadSkins() {
        if (!this.#controller.App.getSession()) {
            return;
        }
        this.#controller.App.GetOwnedSkins({}, (resp) => {
            this.$timeout(() => {
                var ownList = resp || []; // on invalid session resp == null
                for(let skin of resp) {
                    skin.file = CLIENT_SKIN_ROOT + skin.file + '.png';
                    // don't show raw preview in the inventory:
                    // skin.preview = skin.file;
                    skin.owned = true;
                }
                resp.sort((a, b) => a.id - b.id);
                this.list = [...ownList, ...this.staticList];
                this.findSkinIndex();
                // A workaround: when elements are changed, sliders become messed up. Re-create them.
                this.initProfilePage();
            }, 0, true);
        });
    }

    onShow(args) {
        // It's BAD: skins in the list may change after the player opened the list
        // TODO show loading screen
        this.reloadSkins();
    }

    // Init
    async init() {
        this.staticList = await Resources.loadSkins();
        this.list = this.staticList;
        this.findSkinIndex();

        this.#controller.Qubatch.skins = this;
        const skin_id = localStorage.getItem('skin');
        this.#controller.Qubatch.skin = this.currentSkin.id == skin_id 
            ? this.currentSkin : {id: skin_id};
    }

    //
    initProfilePage() {
        // TODO: read var from global scope
        if(typeof initProfilePage == 'undefined') {
            return false
        }
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
            this.onCurrentSkinChange();
        });
        // A workaround: when elements are added, the previously selected thumbnail remains highlighted.
        const parentEl = document.getElementById('div-skin-preview-buttons');
        const thumbs = parentEl.getElementsByClassName('keen-slider__slide');
        for(var i = 0; i < thumbs.length; i++) {
            if (i !== this.index) {
                thumbs[i].classList.remove('active');
            }
        }
    }

    newSkin() {
        this.newSkinClear();
        this.#controller.current_window.show('new_skin');
    }

    deleteSkin() {
        this.restoreSkinIndex = this.index;
        this.#controller.App.DeleteSkin({
            skin_id: this.currentSkin.id
        }, (resp) => {
            this.reloadSkins();
        });
    }

    newSkinClear() {
        this.newSkinDataURL = '';
    }

    newSkinFileChanged($event) {

        function onSkinError(error) {
            Qubatch.App.showError(error, 4000);
            that.#controller.$apply(() => {
                that.newSkinClear();
            });
            // a workaround: angularjs doesn't clear the image when that.newSkinDataURL is set null or ''
            (document.getElementById('new-skin-image') as HTMLImageElement).src = null;
            // it's not bound to ng-model, it's ok to set it directly:
            (document.getElementById('new-skin-input') as HTMLInputElement).value = null;
        }

        //
        const skinImageIsSlim = (img) => {
            const x = 50
            const y = 16
            let canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            let pixelData = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
            return pixelData[3] == 0; 
        }

        var that = this;
        var file = $event.target.files[0];
        if (!file) {
            // A weird Chrome behavior: when a user clicks Cancel in the open file dialogs, the file input clears.
            // A workaround is complex and not angularjs-friendly: https://stackoverflow.com/questions/17798993/input-type-file-clearing-file-after-clicking-cancel-in-chrome
            return;
        }

        const reader = new FileReader();
        reader.onloadend = function () {
            // Load it into an off-screen image to check the size.
            const img = new Image();
            img.onload = function () {

                if (img.naturalWidth != 64 || img.naturalHeight != 64) {
                    return onSkinError('error_skin_size_must_be_64');
                }

                const is_slim = skinImageIsSlim(img)
                const model = is_slim ? 'slim' : 'default';

                that.previewSkinViewer.loadSkin(img, {model})

                that.skin_preview_image = img

                that.#controller.$apply(() => {
                    // Set the actual image. Now it's ready to be uploaded.
                    that.newSkinDataURL = reader.result;
                    that.newSkinFileName = file.name;
                    that.newSkinSlim = is_slim
                });
            };
            img.onerror = function () {
                onSkinError('error_incorrect_image_format');
            };
            (img as any).src = reader.result;
        };
        reader.readAsDataURL(file);
    }

    newSkinOk() {
        const data = this.newSkinDataURL.substring(22); // remove data:image/png;base64,
        this.#controller.App.UploadSkin({
            data: data,
            name: this.newSkinFileName,
            type: this.newSkinSlim ? 1 : 0
        }, (resp) => {
            this.$timeout(() => {
                this.saveSkinId(resp.skin_id);
                this.#controller.current_window.show('skin');
            });
        });
    }

    changePreviewSkinSlim() {
        if(this.skin_preview_image) {
            const model = this.newSkinSlim ? 'slim' : 'default';
            this.previewSkinViewer.loadSkin(this.skin_preview_image, {model})
        }
    }

    newSkinCancel() {
        this.#controller.current_window.show('skin');
    }
}