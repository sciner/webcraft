import {Resources} from "./resources.js";
import {Helpers} from "./helpers.js";

export class Sounds {

    constructor() {
        this.tags = {};
        this.prev_index = new Map();
        for(let item of Resources.sounds) {
            this.add(item);
        }
    }

    async add(item) {
        let audios = new Map();
        for(let action of ['dig', 'place', 'open', 'close', 'hit']) {
            if(item.hasOwnProperty(action)) {
                let volume = 1.;
                if(action == 'hit') {
                    volume = 0.2;
                }
                for(let i in item[action]) {
                    const src = item[action][i];
                    const a = audios.get(src);
                    let ext = src.split('.').pop().toLowerCase();
                    if(a) {
                        item[action][i] = new Howl({src: [a], volume: volume, format: ext});
                    } else {
                        const f = await Helpers.fetch(src).then(response => response.blob())
                        .then(blob => {
                            const blobUrl = URL.createObjectURL(blob);
                            audios.set(src, blobUrl);
                            item[action][i] = new Howl({src: [blobUrl], volume: volume, format: ext});
                        });
                    }
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
        // Remove repeats item play
        let index_key = tag + '/' + action;
        let prev_index = -1;
        if(this.prev_index.has(index_key)) {
            prev_index = this.prev_index.get(index_key);
        }
        let index = -1;
        do {
            // select random item from list
            index = Math.floor(Math.random() * list.length) | 0;
        } while (prev_index == index && list.length > 1);
        this.prev_index.set(index_key, index);
        // Play
        list[index].play();
        return true;
    }

    getList(tag, action) {
        if(!this.tags.hasOwnProperty(tag)) {
            return null;
        }
        return this.tags[tag][action];
    }

}