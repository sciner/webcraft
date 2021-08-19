import {Helpers} from "./helpers.js";

export default class Sounds {

    constructor() {
        let that = this;
        this.tags = {};
        Helpers.loadJSON('../data/sounds.json', function(json) {
            for(let sound of json) {
                that.add(sound);
            }
        });
    }

    add(item) {
        for(let action of ['dig', 'place', 'open', 'close']) {
            if(item.hasOwnProperty(action)) {
                for(let i in item[action]) {
                    let src = item[action][i];
                    item[action][i] = new Howl({src: [src]})
                }
            }
        }
        this.tags[item.type] = item;
    }

    play(tag, action) {
        if(!this.tags.hasOwnProperty(tag)) {
            return;
        }
        const list = this.tags[tag][action];
        let i = Math.floor(Math.random() * list.length);
        list[i].play();
    }

}