import type {State} from "vauxcel";

export interface IMaterialGroupOptions {
    decalOffset?: number;
    cullFace?: boolean;
    opaque?: boolean;
    ignoreDepth?: boolean;
}
export class MaterialGroup implements IMaterialGroupOptions {
    shared = false;
    name = "";

    opaque : boolean;
    ignoreDepth: boolean;
    cullFace: boolean;
    decalOffset: number;

    constructor(options: IMaterialGroupOptions = {}) {
        this.opaque = options.opaque || false;
        this.cullFace = options.cullFace || false;
        this.ignoreDepth = options.ignoreDepth || false;
        this.decalOffset = options.decalOffset || 0;
    }

    applyToState(state: State)
    {
        state.culling = this.cullFace;
        state.depthTest = !this.ignoreDepth;
        state.polygonOffsetValue = -this.decalOffset;
        state.polygonOffsetScale = -this.decalOffset * 2;
    }

    setName(name: string) {
        this.name = name;
        this.shared = true;
    }
}
