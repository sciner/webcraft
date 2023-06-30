import {BLEND_MODES} from "vauxcel";
import {State} from "vauxcel";

export interface IMaterialGroupOptions {
    decalOffset?: number;
    cullFace?: boolean;
    opaque?: boolean;
    ignoreDepth?: boolean;
    blendMode?: BLEND_MODES;
}
export class MaterialGroup implements IMaterialGroupOptions {
    state = new State();
    opaque = false;
    shared = false;

    constructor(options: IMaterialGroupOptions = {}) {
        this.opaque = options.opaque || false;

        this.cullFace = options.cullFace || false;
        this.ignoreDepth = options.ignoreDepth || false;
        this.blendMode = options.blendMode || BLEND_MODES.NORMAL_NPM;
        this.decalOffset = options.decalOffset || 0;
    }

    get blendMode() {
        return this.state.blendMode;
    }

    set blendMode(val: BLEND_MODES) {
        this.state.blendMode = val;
    }

    get cullFace() {
        return this.state.culling;
    }

    set cullFace(val: boolean) {
        this.state.culling = val;
    }

    get ignoreDepth() {
        return !this.state.depthTest;
    }
    set ignoreDepth(val: boolean) {
        this.state.depthTest = !val;
    }

    get decalOffset() {
        return -this.state._polygonOffsetValue;
    }

    set decalOffset(val: number) {
        this.state.polygonOffsetValue = -val;
        this.state.polygonOffsetScale = -2 * val;
    }
}
