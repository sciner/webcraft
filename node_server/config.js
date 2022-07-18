import config from "./conf.json" assert { type: "json" };

if(typeof process != 'undefined') {
    process.argv.forEach((e, i) => {
        // should skip first
        if(i===0) {
            return;
        }

        const [name, value] = e.replace('--', '').split('=');

        if (!(name in config)) {
            return;
        }

        if (typeof value ==='undefined') {
            config[name] = true;
        } else {
            config[name] = isNaN(+value) ? value : +value;
        }
    });
}

export default config;
