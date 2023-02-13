export class Component {
    [key: string]: any;
    static key = 'dummy';
    /**
     * @type {typeof Component[]}
     */
    static require = [];

    constructor() {
        /**
         * @injected
         * @type {Entity}
         */
        this.entity = null;

        /**
         * back references to required component instances from Entity
         * @type {[key: string]: Component}
         */
        this.r = Object.create({});
    }

    /**
     * @type {string}
     */
    get key() {
        return this.constructor.key;
    }

    update (delta, ...args) {

    }

    postUpdate (delta, ...args) {

    }

    /**
     * Init Component
     * All reuired sub-components already should be instanced
     * @param {*} metaModel model of entity
     */
    init(metaModel = null) {

    }

    /**
     * postInit pass, components should be initialised
     * All componets execute their init, you can read some required data
     * @param {*} metaModel model of entity
     */
    postInit() {

    }

    dispose() {
    }
}
