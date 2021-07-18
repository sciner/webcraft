class Sounds {

    constructor() {
        this.tags = {};
        this.tags['wood'] = {
            list: [
                new Howl({src: ["/sounds/wood1.mp3"]}),
                new Howl({src: ["/sounds/wood2.mp3"]}),
                new Howl({src: ["/sounds/wood3.mp3"]}),
                new Howl({src: ["/sounds/wood4.mp3"]})
            ],
            play: function() {
                var i = Math.floor(Math.random() * this.list.length);
                this.list[i].play();
            }
        };
        this.tags['grass'] = {
            list: [
                new Howl({src: ["/sounds/grass1.mp3"]}),
                new Howl({src: ["/sounds/grass2.mp3"]}),
                new Howl({src: ["/sounds/grass3.mp3"]}),
                new Howl({src: ["/sounds/grass4.mp3"]})
            ],
            play: function() {
                var i = Math.floor(Math.random() * this.list.length);
                this.list[i].play();
            }
        };
        this.tags['stone'] = {
            list: [
                new Howl({src: ["/sounds/stone1.mp3"]}),
                new Howl({src: ["/sounds/stone2.mp3"]}),
                new Howl({src: ["/sounds/stone3.mp3"]}),
                new Howl({src: ["/sounds/stone4.mp3"]})
            ],
            play: function() {
                var i = Math.floor(Math.random() * this.list.length);
                this.list[i].play();
            }
        };
        this.tags['gravel'] = {
            list: [
                new Howl({src: ["/sounds/gravel1.mp3"]})
            ],
            play: function() {
                var i = Math.floor(Math.random() * this.list.length);
                this.list[i].play();
            }
        };
        this.tags['click'] = {
            list: [
                new Howl({src: ["/sounds/click.mp3"]})
            ],
            play: function() {
                this.list[0].play();
            }
        };
    }

    play(tag) {
        this.tags[tag].play();
    }

}