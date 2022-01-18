import asLoader from "./asLoader.js";

const DEBUG_MODULE = '/wasm/bin/wasmMath.debug.wasm';
const RELEASE_MODULE = '/wasm/bin/wasmMath.wasm';

/**
 * Proxy class that will process data-tranfering between js and wasm
 * @see https://www.assemblyscript.org/loader.html
 */
export class WasmMath {
    /**
     * @type {WasmMath}
     */
    static instance = null;

    constructor () {
        this.w = null;
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
     * @returns {Promise<WasmMath>}
     */
    static async spawn(debug = true) {
        if (this.instance) {
            return this.instance;
        }

        const api = new WasmMath();
 
        // trap all methods for allowing call it from runtime
        // otherwise this will missed
        const jsApi = new Proxy(this, {
            get(_, prop) {
                if (typeof api[prop] !== 'function') {
                    return api[prop]; // for getters
                }

                // for methods
                return (...args) => api[prop](...args);
            }
        });

        return asLoader
            .instantiate(fetch(debug ? DEBUG_MODULE : RELEASE_MODULE), {
                // MUST BE SAME NAME AS MODULE THAT IMPORTED (jsApi.ts)
                jsApi: jsApi
            })
            .then(({ exports }) => {
                api.w = exports;
                WasmMath.instance = api;
                return api;
            });
    }
}