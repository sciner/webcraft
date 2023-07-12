import * as VAUX from "vauxcel";
import type {BaseRenderer} from "../BaseRenderer.js";

/**
 * util
 */
export function nextPow2(v)
{
    v += v === 0 ? 1 : 0;
    --v;
    v |= v >>> 1;
    v |= v >>> 2;
    v |= v >>> 4;
    v |= v >>> 8;
    v |= v >>> 16;

    return v + 1;
}

export class ObjectDrawer extends VAUX.ObjectRenderer {
    declare renderer: VAUX.Renderer;
    context: BaseRenderer;

    constructor(renderer: VAUX.Renderer) {
        super(renderer);
    }

    initQubatch(context: BaseRenderer) {
        this.context = context;
    }
}
