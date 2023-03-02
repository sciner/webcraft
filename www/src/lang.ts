// import lang_json from "../data/lang.json" assert { type: "json" };
import { Helpers } from "./helpers.js";

export const Lang : Dict = new Proxy(
    {

        default_code: 'en',
        inited: false,

        async init(options) {

            // Load from JSON
            let lang_json = null;
            await Helpers.fetchJSON(options?.lang_file ?? "../data/lang.json", true, 'bs').then((json) => {
                lang_json = json;
            });

            this.strings = lang_json.strings;
            this.list = lang_json.list;
            //
            let lang_code = this.default_code;
            if(typeof localStorage != 'undefined') {
                lang_code = localStorage.getItem('lang') || this.default_code;
            }
            let found = false;
            this.list.map((item) => {
                item.active = item.code == lang_code;
                if(item.active) {
                    lang_code = item.code;
                    found = true;
                }
            })
            this.code = found ? lang_code : this.default_code;
            this.inited = true;
        },

        change(item) {
            if(localStorage) {
                localStorage.setItem('lang', item.code);
            }
            this.init();
        },

        //
        getTranslateFromJSON(json_string) {
            try {
                const obj = JSON.parse(json_string ?? null);
                if(!obj) {
                    return json_string;
                }
                if(this.code in obj) {
                    return obj[this.code];
                } else if(this.default_code in obj) {
                    return obj[this.default_code];
                } else {
                    for(let c in obj) {
                        return obj[c];
                    }
                }
            } catch (e) {
                // Oh well, but whatever...
            }
            return json_string;
        },

        getOrUnchanged(prop) {
            return this.getOrNull(prop) ?? prop;
        },

        /**
         * @param {string} prop 
         * @param {string} default_value 
         * @returns {string}
         */
        getOrDefault(prop, default_value) {
            return this.getOrNull(prop) ?? default_value
        },

        getOrNull(prop) {
            if (prop.startsWith("!lang")) {
                return prop.substr(5);
            }
            const args = prop.split('|');
            const key = args.shift();
            const resp = this.strings[key];
            if(!resp) {
                return null;
            }
            const self = this
            //
            const fill = function(str, args) {
                for(let i = 0; i < args.length; i++) {
                    const transPlace = '%t' + i;
                    if (str.indexOf(transPlace) >= 0) {
                        var v = args[i];
                        const list = self.strings[v];
                        if (list) {
                            v = list[self.code] || list[self.default_code] || v;
                        }
                        str = str.replace(transPlace, v);
                    }
                    str = str.replace(`%${i}`, args[i]);
                }
                return str;
            };
            //
            if(resp[this.code]) {
                return fill(resp[this.code], args);
            }
            return fill(resp[this.default_code], args);
        }

    },
    {
        get(target, prop : string) {
            if(prop in target) {
                return target[prop];
            }
            return target.getOrNull(prop) || `[${prop}]`;
        }
    }
);