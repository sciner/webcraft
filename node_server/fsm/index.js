export class Brains {

    static list = new Map();

    static async init() {
        if(Brains.list.size > 0) {
            return;
        }
        for (let type of ['default', 'chicken', 'creeper', 'horse', 'fox', 'pig', 'snow_golem', 'cow', 'sheep', 'npc', 'zombie', 'bee', 'parrot']) {
            await import(`./brain/${type}.js`).then(module => {
                this.list.set(type, module.Brain);
            });
        }
        this.list.set('default', this.list.get('default'));
    }

    static get(type, mob) {
        let c = null;
        if(this.list.has(type)) {
            c = this.list.get(type);
        } else {
            c = this.list.get('default');
        }
        return new c(mob);
    }

}