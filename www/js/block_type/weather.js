export class Weather {
  
    static CLEAR = 0;
    static RAIN = 1;
    static SNOW = 2;

    static NAMES = ['clear', 'rain', 'snow'];
    static BY_NAME = { clear: 0, rain: 1, snow: 2 };
    
    static getName(id) {
        return this.NAMES[id] || 'clear';
    }
    
}