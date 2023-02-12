export class Weather {
  
    static CLEAR = 0;
    static RAIN = 1;
    static SNOW = 2;

    static NAMES = ['clear', 'rain', 'snow'];
    static BY_NAME = { clear: 0, rain: 1, snow: 2 };

    static SKY_COLOR = [
        [0.4627, 0.767, 1.0],
        [0.4627, 0.767, 0.88],
        [0.52, 0.82, 0.9]
    ];

    static GLOBAL_BRIGHTNESS = [1.0, 0.98, 1.0];

    static FOG_BRIGHTNESS = [1.0, 0.95, 1.0];
    
    static getName(id) {
        return this.NAMES[id] || 'clear';
    }
    
}