export class Brains {

    constructor() {
        this.list = new Map();
    }

    add(type, module) {
        this.list.set(type, module);
    }

    get(type, mob) {
        let c = null;
        if(this.list.has(type)) {
            c = this.list.get(type);
        } else {
            c = this.list.get('default');
        }
        return new c(mob);
    }

}