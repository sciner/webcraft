class Sounds {

    constructor() {
        var that = this;
        this.tags = {};
        Helpers.loadJSON('../sounds.json', function(json) {
            for(var sound of json) {
                that.add(sound);
            }
        });
    }

    add(item) {
        for(var action of ['dig', 'place', 'open', 'close']) {
            if(item.hasOwnProperty(action)) {
                for(var i in item[action]) {
                    var src = item[action][i];
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
        var i = Math.floor(Math.random() * list.length);
        list[i].play();
    }

}