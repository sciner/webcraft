import { Resources } from '../www/js/resources.js';

export class ModelManager {
    constructor() {}

    async init() {
        console.debug('ModelManager.Init()');
        this.list = new Map();
        //
        let data = await Resources.loadModels();
        for (let key in data) {
            // Read assets
            if (key == 'assets') {
                let models = data[key];
                for (let model_name in models) {
                    let model = models[model_name];
                    model.name = model_name;
                    this.list.set(model_name, model);
                }
            }
        }
    }
}
