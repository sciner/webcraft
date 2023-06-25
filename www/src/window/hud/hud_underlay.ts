import {BaseTexture, BLEND_MODES, Container, Rectangle, Texture} from "vauxcel";
import {MySprite} from "../../vendors/wm/MySpriteRenderer.js";

/**
 * cursor can be set by
 * `Qubatch.hud.underlay.crosshair_num = 2`
 */
export class HUD_Underlay extends Container {
    declare addChild: (child: Container) => void;

    crosshairBase = BaseTexture.from("./media/gui/crosshair.png");
    _crosshair_num = 0;
    crosshair_tex: Texture;
    crosshair_sprite: MySprite;

    constructor() {
        super();
        this.init();
    }

    init() {
        this.crosshair_tex = new Texture(this.crosshairBase,
            new Rectangle(this._crosshair_num * 64, 0, 64, 64));
        this.crosshair_sprite = new MySprite(this.crosshair_tex);
        this.crosshair_sprite.blendMode = BLEND_MODES.INVERSE;
        this.crosshair_sprite.anchor.set(0.5);
        this.addChild(this.crosshair_sprite);
    }

    set crosshairOn(val: boolean) {
        this.crosshair_sprite.visible = val;
    }

    get crosshairOn() {
        return this.crosshair_sprite.visible;
    }

    set crosshair_num(val: number) {
        this._crosshair_num = val;
        this.crosshair_tex.frame.x = 64 * this._crosshair_num;
        this.crosshair_tex.updateUvs();
    }

    get crosshair_num() {
        return this._crosshair_num;
    }

    resize(screen: Rectangle, zoom = 1) {
        this.crosshair_sprite.position.set(screen.width / 2, screen.height / 2);
        this.crosshair_sprite.scale.set(zoom / 2)
    }

}