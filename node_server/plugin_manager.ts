export class PluginManager {
    targets: Map<any, any>;

    constructor(config) {
        // Load plugins
        this.targets = new Map();
        this.targets.set('game', []);
        this.targets.set('world',  []);
        this.targets.set('chat',  []);
        for(const [file, plugin] of Object.entries(config.chat_plugins)) {
            for(let target of (plugin as any).targets) {
                if(!this.targets.has(target)) {
                    throw 'invalid_plugin_target|' + file + ':' + target;
                }
                this.targets.get(target).push(plugin);
                console.debug('Plugin loaded: ' + file);
            }
        }
    }

    /**
     * @param {string} target 
     * @param {object} instance 
     * @returns 
     */
    initPlugins(target, instance) {
        const resp = [];
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