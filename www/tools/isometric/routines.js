import {Helpers} from '../../js/helpers.js';

//
const cache = {};
export function lightHex(hex, light_value) {
    light_value = Helpers.clamp(light_value);
    light_value = Math.round(light_value * 255) / 255;
    let k = hex + light_value;
    if(cache.hasOwnProperty(k)) {
        return cache[k];
    }
    light_value = Helpers.clamp(light_value * 2.0);
    let rgb = [
        parseInt(parseInt(hex.substring(1, 3), 16) * light_value),
        parseInt(parseInt(hex.substring(3, 5), 16) * light_value),
        parseInt(parseInt(hex.substring(5, 7), 16) * light_value),
    ];
    return cache[k] = rgb2Hex(rgb);
}

//
export function rgb2Hex(rgb) {
    return '#' + rgb.map(x => ('0' + x.toString(16)).slice(-2)).join('');
}

// Make signal
export function makeSignal(w, h) {
    // minimum two points
    let myPoints = [
        0.01,    0,
        0.3,     0,
        0.35,    0,
        0.45,    0,
        1.0,     0,
    ];
    const tension = 0.5;
    let curve = getCurvePoints(myPoints, tension, false, 63);

    let signal = [];
    for(let i = 0; i < 255; i++) {
        signal.push(parseInt(curve[i * 2] * 255));
    }
    return signal;
}

export function getCurvePoints(pts, tension, isClosed, numOfSegments) {

    // use input value if provided, or use a default value   
    tension = (typeof tension != 'undefined') ? tension : 0.5;
    isClosed = isClosed ? isClosed : false;
    numOfSegments = numOfSegments ? numOfSegments : 16;

    let _pts = [], res = [],    // clone array
        x, y,           // our x,y coords
        t1x, t2x, t1y, t2y, // tension vectors
        c1, c2, c3, c4,     // cardinal points
        st, t, i;       // steps based on num. of segments

    // clone array so we don't change the original
    //
    _pts = pts.slice(0);

    // The algorithm require a previous and next point to the actual point array.
    // Check if we will draw closed or open curve.
    // If closed, copy end points to beginning and first points to end
    // If open, duplicate first points to befinning, end points to end
    if (isClosed) {
        _pts.unshift(pts[pts.length - 1]);
        _pts.unshift(pts[pts.length - 2]);
        _pts.unshift(pts[pts.length - 1]);
        _pts.unshift(pts[pts.length - 2]);
        _pts.push(pts[0]);
        _pts.push(pts[1]);
    }
    else {
        _pts.unshift(pts[1]);   //copy 1. point and insert at beginning
        _pts.unshift(pts[0]);
        _pts.push(pts[pts.length - 2]); //copy last point and append
        _pts.push(pts[pts.length - 1]);
    }

    // ok, lets start..

    // 1. loop goes through point array
    // 2. loop goes through each segment between the 2 pts + 1e point before and after
    for (i=2; i < (_pts.length - 4); i+=2) {
        for (t=0; t <= numOfSegments; t++) {

            // calc tension vectors
            t1x = (_pts[i+2] - _pts[i-2]) * tension;
            t2x = (_pts[i+4] - _pts[i]) * tension;

            t1y = (_pts[i+3] - _pts[i-1]) * tension;
            t2y = (_pts[i+5] - _pts[i+1]) * tension;

            // calc step
            st = t / numOfSegments;

            // calc cardinals
            c1 =   2 * Math.pow(st, 3)  - 3 * Math.pow(st, 2) + 1; 
            c2 = -(2 * Math.pow(st, 3)) + 3 * Math.pow(st, 2); 
            c3 =       Math.pow(st, 3)  - 2 * Math.pow(st, 2) + st; 
            c4 =       Math.pow(st, 3)  -     Math.pow(st, 2);

            // calc x and y cords with common control vectors
            x = c1 * _pts[i]    + c2 * _pts[i+2] + c3 * t1x + c4 * t2x;
            y = c1 * _pts[i+1]  + c2 * _pts[i+3] + c3 * t1y + c4 * t2y;

            //store points in array
            res.push(x);
            res.push(y);

        }
    }

    return res;
}
