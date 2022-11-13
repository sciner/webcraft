export function blank() {}

await import('../../js/terrain_generator/default.js').then(module => {

    const noise = module.noise;

    //
    const seed = 0; // allow only numeric values
    noise.seed(seed);

    let canvas = document.getElementById('canvas3D');
    let ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = 1024;
    canvas.height = 1024;

    // Отрисовка карты
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'green';
    ctx.beginPath();

    const circle = {
        x:      canvas.width/2,
        y:      canvas.height/2,
        radius: canvas.width * 0.28
    };

    const frequency = 2.15;
    const magnitude = .5;
    const s = Math.random() * canvas.width; // seed;

    for(let i = 0; i <= 360; i++) {

        const angle = (2 * Math.PI * (i/360));

        // Figure out the x/y coordinates for the given angle
        const x = Math.cos(angle);
        const y = Math.sin(angle);

        // Randomly deform the radius of the circle at this point
        const deformation = noise.perlin3(x * frequency, y * frequency, s) + 1;
        const radius = circle.radius * (1 + magnitude * deformation);

        // Extend the circle to this deformed radius
        ctx.lineTo(circle.x + radius * x, circle.y + radius * y);

    }

    ctx.fill();
    ctx.stroke();

});