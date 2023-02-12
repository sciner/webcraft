import WebGLRenderer from './webgl/index.js';
import WebGPURenderer from './webgpu/index.js';

const RENDERS =  [
    WebGPURenderer,
    WebGLRenderer
];

export default {
    /**
     * Query evailable renderer
     * @param {HTMLCanvasElement} view 
     * @param {'webgl' | 'webgpu' | 'auto'} type
     * @param {*} options 
     */
    getRenderer(view, type = 'webgl', options = {}) {

        if (type === 'auto') {
            for(let Ctor of RENDERS) {
                if(Ctor.test(view, options)) {
                    console.debug('[Renderer] Select renderer:', Ctor.kind);
                    return this.currentRenderer = new Ctor(view, options);
                }
            }

            throw new Error('Your device not support any renders:' + RENDERS.map(e => e.kind).join(','));
        }

        const Ctor = RENDERS.find(e => e.kind === type);

        if (!Ctor) {
            throw new Error('Unknown renderer type:' + type);
        }

        if (!Ctor.test(view, options)) {
            throw new Error('Your device not support render:' + Ctor.kind);
        }

        return this.currentRenderer = new Ctor(view, options);
    },

    currentRenderer: null
}