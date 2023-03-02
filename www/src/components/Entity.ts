import { Component } from "./Component.js";
import { Model } from "./Model.js";
import { Transform } from "./Transform.js";

export class Entity {
    [key: string]: any;
    /**
     * @type {[key: string] : typeof Component}
     */
    static componentRegistry = Object.create({});
    /**
     * 
     * @param {typeof Component} componentClass 
     * @returns 
     */
    static register(componentClass) {
        if (!componentClass || !componentClass.key) {
            return this;
        }

        if (componentClass.key in this.componentRegistry) {
            return this;
        }

        this.componentRegistry[componentClass.key] = componentClass;

        if (componentClass.require) {
            for(const subb of componentClass.require) {
                this.register(subb);
            }
        }

        return this;
    }

    /**
     * Unroll components and resolve dependensies
     * @param {typeof Component} from 
     * @param {Array<typeof Component>} result 
     * @returns 
     */

    static unrollRequired (from, result) {

        if (!from || !(from.key in this.componentRegistry)) {
            console.error('Unknown component, ignore', from.key);
            return result;
        }

        for (const subb of from.require) {

            if (result.indexOf(subb) > -1) {
                continue;
            }

            Entity.unrollRequired(subb, result);

            result.push(subb);
        }

        return result;
    }

    /**
     * Spawn new Entity with specific components
     * @param {{[key: string] : Object}} dataModel
     */
    constructor (dataModel) {
        this._components = Object.create({});
        this._model = dataModel;
        this._uuid = crypto.randomUUID();

        this.add(dataModel);
    }

    /**
     * Query component
     * @param {string | typeof Component} componentNameOrClass 
     * @returns {typeof Component}
     */
    get(componentNameOrClass) {
        if (!componentNameOrClass) {
            return null;
        }

        if (typeof componentNameOrClass === 'string') {
            return this._components[componentNameOrClass] || null;
        }

        return this._components[componentNameOrClass.key] || null;
    }
    
    /**
     * Add component or components to entity
     * Params store {componentKey: data, componentKey2: data2, fields}
     * @param {{[key: string] : Object}} dataModel
     * @returns {this}
     */
    add(dataModel) {
        if (!dataModel) {
            return;
        }

        const newComponents = [];

        for (const key in dataModel) {
            this._add(key, dataModel, newComponents);
        }

        // execute post init for new components
        for (const comp of newComponents) {
            comp.postInit();
        }
    }

    _add(key, dataModel, newComponents = []) {
        if (!key) {
            return this;
        }

        const older = this.get(key);

        if (older) {
            older.init(dataModel);
            return older;
        }

        const compCtors = Entity
            // resolve
            .unrollRequired(Entity.componentRegistry[key], [])
            // remove componets that already exist
            .filter(({key}) => !this._components[key]);

        const compInstance = this._components;

        // we should resolve required componets before init
        for(let Ctor of compCtors) {
            const component = new Ctor();
            
            newComponents.push(component);

            compInstance[Ctor.key] = component;
            // inject to instance body
            this[Ctor.key] = component;
        }

        for(let Ctor of compCtors) {
            const component = compInstance[Ctor.key];
            // resolve injected references
            const r = Ctor.require.reduce((acc, {key}) => (acc[key] = compInstance[key], acc), {});

            // inject
            component.r = r;
 
            // inject
            component.entity = this;

            // call init
            component.init(dataModel);
        }

        return newComponents;
    }
}

/**
 * Register a componets for Entity
 */
Entity
    .register(Transform)
    .register(Model)