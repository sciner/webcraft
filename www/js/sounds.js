import {Resources} from "./resources.js";

export class Sounds {

    constructor() {
        this.tags = {};
        for(let item of Resources.sounds) {
            this.add(item);
        }
    }

    add(item) {
        for(let action of ['dig', 'place', 'open', 'close', 'hit']) {
            if(item.hasOwnProperty(action)) {
                let volume = 1.;
                if(action == 'hit') {
                    volume = 0.2;
                }
                for(let i in item[action]) {
                    let src = item[action][i];
                    item[action][i] = new Howl({src: [src], volume: volume})
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
        return true;
    }

    getList(tag, action) {
        if(!this.tags.hasOwnProperty(tag)) {
            return null;
        }
        return this.tags[tag][action];
    }

}