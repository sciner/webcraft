import { Button } from "../ui/wm.js";
import { Lang } from "../lang.js";
import { Helpers } from "../helpers.js";
import { BlankWindow } from "./blank.js";
import { Resources } from "../resources.js";

export class ScreenshotWindow extends BlankWindow {
    [key: string]: any;

    constructor(player) {

        super(0, 0, 400 , 460, "frmScreenshot", null, null)
        this.w *= this.zoom
        this.h *= this.zoom
        this.player = player

        this.setBackground('./media/gui/form-empty.png', 'stretchcenter', 1)

        // Append JSON layout
        this.appendLayout(Resources.layout.screenshot)

        const ql = this.getWindow('vLayout')
        ql.getWindow('btnDownload').onMouseDown = () => {
            Qubatch.hud.wm.closeAll()
            Helpers.downloadBlobPNG(this.screenshot_blob, 'screenshot.webp')
        }
        ql.getWindow('btnSetCover').onMouseDown = () => {
            Qubatch.hud.wm.closeAll()
            this.send(true)
        }
        ql.getWindow('btnSaveToGallery').onMouseDown = () => {
            Qubatch.hud.wm.closeAll()
            this.send(false)
        }

        // Add labels to window
        // this.addWindowTitle(Lang.screen_taken)

        // Add close button
        this.addCloseButton()

    }

    // Обработчик открытия формы
    onShow(args) {
        this.getRoot().center(this)
        Qubatch.releaseMousePointer()
        super.onShow(args)
    }

    // Обработчик закрытия формы
    onHide() {}

    // Make screenshot
    make() {

        const ql = this.getWindow('vLayout');
        const lblPreview = ql.getWindow('lblPreview');
        lblPreview.title = Lang.loading;

        const im_world_admin = this.player.session.user_id == this.player.world.info.user_id

        if(!im_world_admin || (typeof LocalServerClient != 'undefined')) {
            ql.delete('btnSetCover');
            ql.delete('btnSaveToGallery');
        }
        ql.refresh()

        // Make screenshot
        Qubatch.render.screenshot((blob) => {

            this.show()

            const fileFromBlob = new File([blob], 'image.webp', {type: 'image/webp'});
            this.screenshot_blob = blob
            this.screenshot_file = fileFromBlob;
            ql.enabled = true;

            const img = new Image();
            img.onload = () => {

                lblPreview.text = '';
                lblPreview.clip()
                lblPreview.setBackground(img, 'cover')
                //ql.refresh()

                // generate preview
                const MAX_PREVIEW_SIZE = 512
                const w = Math.round(img.width > img.height ? MAX_PREVIEW_SIZE : img.width / (img.height / MAX_PREVIEW_SIZE))
                const h = Math.round(img.height > img.width ? MAX_PREVIEW_SIZE : img.height / (img.width / MAX_PREVIEW_SIZE))
                const canvas_preview = document.createElement('canvas')
                canvas_preview.width = w
                canvas_preview.height = h
                const ctx_preview = canvas_preview.getContext('2d')
                ctx_preview.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h)
                canvas_preview.toBlob((previewBlob) => {
                    this.screenshot_file_preview = new File([previewBlob], 'image-preview.webp', {type: 'image/webp'});
                }, 'image/webp')

            }
            img.src = URL.createObjectURL(fileFromBlob)

        })

    }

    // Send screenshot to server
    send(as_cover) {
        const form = new FormData();
        form.append('file', this.screenshot_file);
        form.append('file_preview', this.screenshot_file_preview);
        form.append('world_id', Qubatch.world.info.guid);
        form.append('as_cover', as_cover);
        Qubatch.App.Screenshot(form, function(result) {
            if (result.result == "ok") {
                vt.success("Screenshot uploaded to server");
            } else {
                vt.error("Error upload screenshot");
            }
        });
    }

}