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

export default {...conf, ...conf_world};
