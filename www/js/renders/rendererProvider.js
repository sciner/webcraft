// out of render module
// needed for lazy load
const RENDERS = [
    {
        kind: 'webgpu',
        path: './webgpu/index.js',
        test: (view, options) => {
            const context = navigator.gpu && view.getContext('webgpu');
            return !!context;
        }
    },
    {
        kind: 'webgl',
        path: './webgl/index.js',
        test: (view, options) => {
            const context = view.getContext('webgl2', options);
            return !!context;       }
    }
];

/**
 * Loader class, provide lazy render loading but inited sync
 * We can't use async instansing because should know rendere type on constructor phase
 */
class RenderLoader {
    constructor(info, view, options = {}) {
        this.kind = info.kind;
        this.path = info.path;

        this.renderBackend = null;

        // spawn promise and load module
        this._loadPromise = import(this.path)
            .then(({default: Ctor}) => {
                return this.renderBackend = new Ctor(view, options);
            });
    }

    async init (...args) {
        const backend = await this._loadPromise;

        backend.init(...args);

        return backend;
    }
}

export default {
    /**
     * Query specific render loader, on this stage real rendere not constructed
     * @param {HTMLCanvasElement} view 
     * @param {'webgl' | 'webgpu' | 'auto'} type
     * @param {*} options 
     * @returns {RenderLoader}
     */
    getRendererLoader(view, type = 'webgl', options = {}) {
        if (type === 'auto') {
            for(let renderInfo of RENDERS) {
                if(renderInfo.test(view, options)) {
                    console.debug('[Renderer] Select renderer:', renderInfo.kind);
                    return new RenderLoader(renderInfo, view, options);
                }
            }

            throw new Error('Your device not support any renders:' + RENDERS.map(e => e.kind).join(','));
        }

        const info = RENDERS.find(e => e.kind === type);

        if (!info) {
            throw new Error('Unknown renderer type:' + type);
        }

        if (!info.test(view, options)) {
            throw new Error('Your device not support render:' + info.kind);
        }

        return new RenderLoader(info, view, options);
    }
}