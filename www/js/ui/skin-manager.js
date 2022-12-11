import {Helpers} from '../helpers.js';
import {Resources} from '../resources.js';

export class SkinManager {

    #controller;

    constructor($scope, $timeout) {   
        // https://ru.namemc.com/minecraft-skins/trending/top?page=5
        this.#controller    = $scope;
        this.$timeout       = $timeout;
        this.list           = [];
        this.index          = 0;
        this.loading        = true;
        this.newSkinSlim    = false;
        this.newSkinDataURL = '';
        this.newSkinFileName = '';
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

    newSkin() {
        this.newSkinClear();
        this.#controller.current_window.show('new_skin');
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
            document.getElementById('new-skin-image').src = null;
            // it's not bound to ng-model, it's ok to set it directly:
            document.getElementById('new-skin-input').value = null;
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
                    onSkinError('error_skin_size_must_be_64');
                    return;
                }
                that.#controller.$apply(() => {
                    // Set the actual image. Now it's ready to be uploaded.
                    that.newSkinDataURL = reader.result;
                    that.newSkinFileName = file.name;
                });
            };
            img.onerror = function () {
                onSkinError('error_incorrect_image_format');
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    }

    newSkinOk() {
        const data = this.newSkinDataURL.substring(22); // remove data:image/png;base64,
        this.#controller.App.UploadSkin({
            data: data,
            name: this.newSkinFileName,
            isSlim: this.newSkinSlim
        }, (resp) => {
            this.$timeout(() => {
                this.#controller.current_window.show('skin');
            });
        });
    }

    newSkinCancel() {
        this.#controller.current_window.show('skin');
    }
}