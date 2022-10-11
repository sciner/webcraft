export class Weather {
  
    static CLEAR = 0;
    static RAIN = 1;
    static SNOW = 2;
    
    static get(id) {
        switch(id) {
            case 2: 
                return 'snow';
            case 1: 
                return 'rain';
        }
        return 'clear';
    }
    
}