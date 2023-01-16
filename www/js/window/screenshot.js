import { Button, Label, Window } from "../../tools/gui/wm.js";
import { Lang } from "../lang.js";
import { Helpers } from "../helpers.js";

export class ScreenshotWindow extends Window {

    constructor(player) {

        super(10, 10, 400, 420, "frmScreenshot", null, null);

        this.w *= this.zoom;
        this.h *= this.zoom;

        // Get window by ID
        const ct = this;
        ct.style.background.color = '#00000000';
        ct.style.background.image_size_mode = 'stretch';
        ct.style.border.hidden = true;
        ct.setBackground('./media/gui/form-empty.png');
        ct.hide();

        const PADDING = 20 * this.zoom;

        // Append JSON layout
        this.appendLayout({
            vLayout: {
                type: 'VerticalLayout',
                x: PADDING,
                y: PADDING,
                width: this.width - PADDING * 2,
                visible: true,
                gap: 20,
                enabled: false,
                childs: {
                    lblDesc: {
                        type: 'Label',
                        word_wrap: true,
                        width: 300 * this.zoom,
                        height: 20 * this.zoom,
                        title: null,
                        autosize: false,
                        text: 'You have taken a screenshot. Farther??',
                        style: {
                            font: {size: 17 * this.zoom},
                            background: {color: '#ffffff00'}
                        }
                    },
                    lblPreview: {
                        type: 'Label',
                        word_wrap: true,
                        height: 200 * this.zoom,
                        title: Lang.loading,
                        // autosize: false,
                        style: {
                            padding: 0,
                            font: {size: 17 * this.zoom},
                            textAlign: {
                                horizontal: 'center',
                                vertical: 'middle'
                            },
                            background: {
                                color: '#00000044',
                                image_size_mode: 'cover', // none | stretch | cover
                                image: null
                            }
                        }
                    },
                    btnDownload: {
                        type: 'Button',
                        title: 'Download screenshot',
                        height: 40 * this.zoom,
                        // autosize: false,
                        onMouseDown: () => {
                            Qubatch.hud.wm.closeAll();
                            Helpers.downloadBlobPNG(this.screenshot_blob, 'screenshot.webp');
                        }
                    },
                    btnSetCover: {
                        type: 'Button',
                        title: 'Set as world cover',
                        height: 40 * this.zoom,
                        //autosize: false,
                        onMouseDown: () => {
                            Qubatch.hud.wm.closeAll();
                            this.send(true);
                        }
                    },
                    btnSaveToGallery: {
                        type: 'Button',
                        title: 'Upload to gallery',
                        height: 40 * this.zoom,
                        //autosize: false,
                        onMouseDown: () => {
                            Qubatch.hud.wm.closeAll();
                            this.send(false);
                        }
                    }
                }
            }
        });

        // Обработчик открытия формы
        this.onShow = function() {
            this.getRoot().center(this);
            Qubatch.releaseMousePointer();
        }

        // Обработчик закрытия формы
        this.onHide = function() {}

        // Add close button
        this.loadCloseButtonImage((image) => {
            // Add buttons
            const ct = this;
            // Close button
            let btnClose = new Button(ct.width - 40 * this.zoom, 15 * this.zoom, 20 * this.zoom, 20 * this.zoom, 'btnClose', '');
            btnClose.style.font.family = 'Arial';
            btnClose.style.background.image = image;
            btnClose.z = 1;
            // btnClose.style.background.image_size_mode = 'stretch';
            btnClose.onDrop = btnClose.onMouseDown = function(e) {
                ct.hide();
            }
            ct.add(btnClose);
        });

        // Hook for keyboard input
        this.onKeyEvent = (e) => {
            const {keyCode, down, first} = e;
            switch(keyCode) {
                case KEY.ESC: {
                    if(!down) {
                        ct.hide();
                        try {
                            Qubatch.setupMousePointer(true);
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    return true;
                }
            }
            return false;
        }
    }

    // Make screenshot
    make() {
        const ql = this.getWindow('vLayout');
        const lblPreview = ql.getWindow('lblPreview');
        lblPreview.title = Lang.loading;

        if(typeof LocalServerClient != 'undefined') {
            ql.delete('btnSetCover');
            ql.delete('btnSaveToGallery');
        }

        Qubatch.render.screenshot((blob) => {
            this.show();
            const fileFromBlob = new File([blob], 'image.webp', {type: 'image/webp'});
            this.screenshot_blob = blob
            this.screenshot_file = fileFromBlob;
            ql.enabled = true;
            const img = new Image();
            img.onload = function() {
                lblPreview.title = '';
                lblPreview.style.background.image = img;
            }
            img.src = URL.createObjectURL(fileFromBlob);

        });
    }

    // Send screenshot to server
    send(as_cover) {
        const form = new FormData();
        form.append('file', this.screenshot_file);
        form.append('world_id', Qubatch.world.info.guid);
        form.append('as_cover', as_cover);
        Qubatch.App.Screenshot(form, function(result) {
            if (result.result == "ok") {
                vt.success("Screenshot upload to server");
            } else {
                vt.error("Error upload screenshot");
            }
        });
    }

}