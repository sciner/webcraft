//@ts-check
import BaseRenderer from "../BaseRenderer.js";

export default class WebGLRenderer extends BaseRenderer {
    constructor(view, options) {
        super(view, options);
        /**
         *
         * @type {WebGL2RenderingContext}
         */
        this.gl = null;
    }

    async init() {
        this.gl = this.view.getContext('webgl2', this.options);

        return Promise.resolve(this);
    }

    resize(w, h) {
        super.resize(w, h);

        this.view.width = w;
        this.view.height = h;
    }

    _configure() {
        super._configure();
    }
}

/**
 * 
 * @param {HTMLCanvasElement} view 
 */
WebGLRenderer.test = function(view, options = {}) {
    /**
     * @type {*}
     */
    const context = view.getContext('webgl2', options);

    return !!context;
}

WebGLRenderer.kind = 'webgl';