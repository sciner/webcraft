import lang_json from "../data/lang.json" assert { type: "json" };

export const Lang = new Proxy(
    {

        default_code: 'en',

        init() {
            this.strings = lang_json.strings;
            this.list = lang_json.list;
            //
            let lang_code = localStorage.getItem('lang') || this.default_code;
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
            localStorage.setItem('lang', item.code);
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
            let resp = target.strings[prop];
            if(!resp) {
                return `[${prop}]`;
            }
            return resp[target.code];
        }
    }
);