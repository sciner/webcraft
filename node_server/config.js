import { Vector } from "../www/js/helpers.js";
import conf from "./conf.json" assert { type: "json" };
import conf_world from "./conf_world.json" assert { type: "json" };

if(typeof process != 'undefined') {
    process.argv.forEach((e, i) => {
        // should skip first
        if(i===0) {
            return;
        }

        const [name, value] = e.replace('--', '').split('=');

        if (!(name in conf)) {
            return;
        }

        if (typeof value ==='undefined') {
            conf[name] = true;
        } else {
            conf[name] = isNaN(+value) ? value : +value;
        }
    });
}

export default await new Promise(async resolve => {

    for(let k in conf_world.building_schemas) {
        const item = conf_world.building_schemas[k]
        await import(`./data/building_schema/${item.name}.json`, {assert: { type: 'json' }}).then(module => {
            const json = module.default
            json.name = item.name
            json.meta = json.meta ?? {}
            item.entrance = new Vector(json.world.entrance)
            json.world = {...json.world, ...item}
            conf_world.building_schemas[k] = json
        })
    }

    resolve({...conf, ...conf_world})

})