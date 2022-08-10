// import lang_json from "../data/lang.json" assert { type: "json" };
import { Helpers } from "./helpers.js";

export const Lang = new Proxy(
    {

        default_code: 'en',

        async init() {

            // Load from JSON
            let lang_json = null;
            await Helpers.fetchJSON("../data/lang.json", true, 'bs').then((json) => {
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
                const obj = JSON.parse(json_string);
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
        }

    },
    {
        get(target, prop) {
            if(prop in target) {
                return target[prop];
            }
            const args = prop.split('|');
            const key = args.shift();
            const resp = target.strings[key];
            if(!resp) {
                return `[${prop}]`;
            }
            //
            const fill = function(str, args) {
                for(let i = 0; i < args.length; i++) {
                    str = str.replace(`%${i}`, args[i]);
                }
                return str;
            };
            //
            if(resp[target.code]) {
                return fill(resp[target.code], args);
            }
            return fill(resp[target.default_code], args) || `[${prop}]`;
        }
    }
);