import {Resources} from "@client/resources.js";

export class ModelManager {
    list: Map<string, any>;

    constructor() {}
    
    async init() {
        console.debug('ModelManager.Init()');
        this.list = new Map();
        //
        // const data = await Resources.loadModels()
        // for(const key in data) {
        //     // Read assets
        //     if (key == 'assets') {
        //         const models = data[key];
        //         for(const model_name in models) {
        //             const model = models[model_name];
        //             model.name = model_name;
        //             this.list.set(model_name, model);
        //         }
        //     }
        // }
    }

}
