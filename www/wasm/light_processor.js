import asLoader from "./asLoader.js";

const DEBUG_MODULE = '/wasm/light_processor.debug.wasm';
const RELEASE_MODULE = '/wasm/light_processor.release.wasm';

/**
 * Proxy class that will process data-tranfering between js and wasm
 * @see https://www.assemblyscript.org/loader.html
 */
export class LightProcessor {
    /**
     * @type {LightProcessor}
     */
    static instance = null;

    constructor () {
        this.w = null;

        // trap all methods for allowing call it from runtime
        this.proxyInterface = new Proxy(this, {
            get(r, prop) {
                return (...args) => r[prop](...args);
            }
        });
    }

    /**
     * Debug method, wasm module should call back _asHello
     */
    sayHello() {
        this.w.sayHello();
    }

    /**
     * @type {WebAssembly.Memory}
     */
    get mem() {
        return this.w.module.memory;
    }

    /**
     * wasm api method
     * @param {number} data 
     */
    _asHello (data) {
        console.log('Wasm hello!', data);
    }

    /**
     * Spawn new WASM proxy class
     * @param {boolean} debug 
     * @returns {Promise<LightProcessor>}
     */
    static async spawn(debug = true) {
        if (this.instance) {
            return this.instance;
        }

        const api = new LightProcessor();

        return asLoader
            .instantiate(fetch(debug ? DEBUG_MODULE : RELEASE_MODULE), {
                // MUST BE SAME NAME AS MODULE THAT IMPORTED (jsApi.ts)
                jsApi: api.proxyInterface
            })
            .then(({ exports }) => {
                api.w = exports;
                LightProcessor.instance = api;
                return api;
            });
    }
}