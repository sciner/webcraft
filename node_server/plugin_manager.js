export class PluginManager {

    constructor() {
        // Load plugins
        this.targets = new Map();
        this.targets.set('game', []);
        this.targets.set('world',  []);
        this.targets.set('chat',  []);
        const pluginFolder = './plugins/';
        fs.readdir(pluginFolder, (err, files) => {
            files.forEach(file => {
                import(pluginFolder + file).then(module => {
                    for(let target of module.default.targets) {
                        if(!this.targets.has(target)) {
                            throw 'invalid_plugin_target|' + file + ':' + target;
                        }
                        this.targets.get(target).push(module.default);
                        console.log('Plugin loaded: ' + file);
                    }
                });
            });
        });
    }

    initPlugins(target, instance) {
        let resp = [];
        const targets = this.targets.get(target);
        if(targets) {
            for(let item of targets) {
                const plugin = new item(instance);
                switch(target) {
                    case 'game': {
                        plugin.onGame(instance);
                    }
                    case 'world': {
                        plugin.onWorld(instance);
                    }
                    case 'chat': {
                        plugin.onChat(instance);
                    }
                }
                resp.push(plugin);
            }
        }
        return resp;
    }

}