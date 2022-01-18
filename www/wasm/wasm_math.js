import * as asBind from "./as-bind.esm.js";

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
        this.w.sayHello("FromJS");
    }

    /**
     * @type {WebAssembly.Memory}
     */
    get mem() {
        return this.w.module.memory;
    }

    /**
     * wasm api method
     * @param {string} data 
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

        // we should bind all methods from prototype 
        // because as-bind not support proxies
        const jsApi = {};
        const desc = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(api));

        // bound only methods
        for(let key in desc) {
            if (typeof desc[key].value === 'function') {    
                jsApi[key] = desc[key].value.bind(api);
            }
        }

        return asBind
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