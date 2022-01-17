// change it to more likenly directory
import asLoader from "./asLoader.js";

const DEBUG_MODULE = '/wasm/light_processor.debug.wasm';
const RELEASE_MODULE = '/wasm/light_processor.release.wasm';

export class LightProcessor {
    /**
     * @type {LightProcessor}
     */
    static instance = null;

    constructor () {
        this.w = null;

        // trap all methods for allowing call it from runtime
        this.proxyInterface = new Proxy(this, {
            get(_, prop) {
                return (...args) => this[prop](...args);
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
                jsApi: api.proxyInterface
            })
            .then(({ exports }) => {
                api.w = exports;
                LightProcessor.instance = api;
                return api;
            });
    }
}