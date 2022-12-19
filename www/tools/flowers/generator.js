import { createNoise2D, createNoise3D } from '../../vendors/simplex-noise.js';
import { alea } from '../../js/terrain_generator/default.js';
import { SimpleQueue } from '../../js/helpers.js';

export function blank() {}

//
const seed = 17 // performance.now(); // allow only numeric values
const max_radius = 512;

let canvas = document.getElementById('canvas3D');
let ctx = canvas.getContext('2d', { alpha: false });
ctx.fillStyle = "#333";
canvas.width = max_radius * 2;
canvas.height = max_radius * 2;
ctx.fillRect(0, 0, canvas.width, canvas.height);

//
function makeWorm(seed, samples, start_samples_index, length, params, noise3d, result = null) {

    const magnitude = .5
    const frequency = 1.5

    result = []

    function lineBresenham2D(x0, y0, x1, y1) {
        var dx = Math.abs(x1 - x0);
        var dy = Math.abs(y1 - y0);
        var sx = (x0 < x1) ? 1 : -1;
        var sy = (y0 < y1) ? 1 : -1;
        var err = dx - dy;
        let at = 0;
        while(true) {
            result.push(x0, y0)
            if ((x0 === x1) && (y0 === y1)) break;
            var e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0  += sx; }
            if (e2 < dx) { err += dx; y0  += sy; }
        }
    }

    for(let i = 0; i <= length; i++) {
        const limit_radius = params.radius * 0.25 // + (i/length - .5) * params.radius / 2
        let j = (i + start_samples_index) % samples
        const angle = (2 * Math.PI * (j / samples));
        // Figure out the x/y coordinates for the given angle
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        // Randomly deform the radius of the circle at this point
        const deformation = noise3d(x * frequency, y * frequency, seed) + 1;
        const radius = limit_radius * (1 + magnitude * deformation);
        const x0 = (params.x + radius * x) | 0
        const y0 = (params.y + radius * y) | 0
        result.push(x0, y0)
        /*
        const len = result.length
        if(i == 0) {
            result.push(x0, y0)
        } else {
            lineBresenham2D(result[len - 2], result[len - 1], x0, y0)
        }*/
    }

    return result;

}

    const al = new alea(seed);
function loop() {

    const noise3d = createNoise3D(al.double);
    const caves = []
    const attempts = 32

    // ctx.fillStyle = "#333";
    // ctx.fillRect(0, 0, canvas.width, canvas.height);

    const p = performance.now();
    for(let i = 0; i < attempts; i++) {
        const mr = 256
        const r = mr + Math.round(mr * al.double() * 2)
        const circle = {
            x:      r / 2,
            y:      r / 2,
            radius: r
        };
        circle.x = Math.round((al.double() - .5) * circle.radius * 2)
        circle.y = Math.round((al.double() - .5) * circle.radius * 2)
        const s = al.double() * 1000000
        const samples = 100
        const length_percent = 25 + Math.floor(al.double() * 25)
        const length = Math.round(samples / 100 * length_percent) + 1
        const start_index = Math.floor(al.double() * samples)
        // const start_index = Math.round((al.double() + performance.now() / 10000) * samples)
        const points = makeWorm(s, samples, start_index, length, circle, noise3d, null)
        caves.push(points)
    }

    const per_sec = Math.round(1000 / ((performance.now() - p) / attempts))
    document.getElementById('dbg').innerText = `${per_sec} persec`

    // Draw
    ctx.lineWidth = 5;
    const colors = ['red', 'yellow', 'blue', 'green', 'magenta', 'orange', 'white', 'gray', 'lightblue'];
    let color_index = 0;
    for(let cave of caves) {
        ctx.fillStyle = ctx.strokeStyle = colors[(color_index++) % colors.length];
        drawPoints(cave, false)
    }

    // Draw chunks dots
    ctx.fillStyle = '#656565'
    for(let x = 16; x < canvas.width; x += 16) {
        for(let y = 16; y < canvas.height; y += 16) {
            ctx.fillRect(x, y, 1, 1)
        }
    }

    window.requestAnimationFrame(loop)

}

window.requestAnimationFrame(loop)

// Отрисовка
function drawPoints(points, stroke = true) {
    for(let i = 2; i < points.length; i += 2) {
        // ctx.beginPath();
        ctx.fillRect(points[i] + max_radius, points[i + 1] + max_radius, 2, 2)
        // ctx.moveTo(points[i] + max_radius, points[i + 1] + max_radius);
        // ctx.lineTo(points[i - 2] + max_radius, points[i - 2 + 1] + max_radius);
        // ctx.stroke();
    }
}
