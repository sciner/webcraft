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

        change: function(item) {
            localStorage.setItem('lang', item.code);
            location.reload();
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