import { Component } from "./Component.js";
import { Transform } from "./Transform.js";

/**
 * Model component for scene system
 * Include renderable for execution render process
 */
export class Model extends Component {
    [key: string]: any;
    static key = 'model';

    constructor() {
        super()
        this._geometry = null;
        this._material = null;
    }

    render (engine) {
        throw new Error('render not implemented');
    }
}
