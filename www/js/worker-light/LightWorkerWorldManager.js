import { LightWorld } from "./LightWorld.js";

export class LightWorkerWorldManager {

    constructor(worker) {
        this.all = new Map();
        this.list = [];
        this.curIndex = 0;
        this.worker = worker;

        this.renderOptions = {
            texFormat: 'rgba8',
            hasNormals: false
        }
    }

    setRenderOptions(go) {
        this.renderOptions = go;
        for (let i = 0; i < this.list.length; i++) {
            this.list[i].setRenderOptions(go);
        }
    }

    getOrCreate(world_id) {
        if(this.all.has(world_id)) {
            return this.all.get(world_id);
        }
        const world = new LightWorld(this.worker, world_id);
        world.setRenderOptions(this.renderOptions);
        this.all.set(world_id, world);
        this.list.push(world);
        return world;
    }

    dispose(world_id) {
        const world = this.all.remove(world_id);
        if (world) {
            this.list.splice(this.list.indexOf(world), 1);
        }
    }

    // TODO: make chunk_worker and light_worker same hierarchy of managers
    process({maxMs = 20}) {
        const {list} = this;
        let ind = this.curIndex;
        let looped = 0;
        let start = performance.now();
        let passed = 0;

        if (list.length === 0) {
            return;
        }

        while (passed < maxMs && looped < list.length) {
            let world = list[ind];
            if (world.process({maxMs: maxMs - passed}) > 1) {
                looped = 0;
            } else {
                looped++;
            }
            ind = (ind + 1) % list.length;
            passed = performance.now() - start;
        }
        this.curIndex = ind;
    }
}