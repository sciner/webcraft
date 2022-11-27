export function blank() {}

await import('../../js/terrain_generator/default.js').then(module => {

    const noise = module.noise;

    //
    const seed = 0; // allow only numeric values
    noise.seed(seed);

    const max_radius = 1000;
    let canvas = document.getElementById('canvas3D');
    let ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = max_radius;
    canvas.height = max_radius;

    // Отрисовка карты
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'green';
    ctx.beginPath();

    const circle = {
        x:      max_radius / 2,
        y:      max_radius / 2,
        radius: max_radius * 0.25
    };

    const samples = 360;
    const max_count = 1;
    const p = performance.now();
    let errors = 0;

    for(let cnt = 0; cnt < max_count; cnt++) {

        const frequency = 1.25;
        const magnitude = .5;
        const s = 2931794084 + Math.random() * 1000000;
        let has_error = false;

        for(let i = 0; i <= samples; i++) {

            const angle = (2 * Math.PI * (i/samples));

            // Figure out the x/y coordinates for the given angle
            const x = Math.cos(angle);
            const y = Math.sin(angle);

            // Randomly deform the radius of the circle at this point
            const deformation = noise.simplex3(x * frequency, y * frequency, s) + 1;
            const radius = circle.radius * (1 + magnitude * deformation);

            // Extend the circle to this deformed radius
            if(radius * x >= circle.radius || radius * y >= circle.radius) {
                has_error = true;
            }
            ctx.lineTo(circle.x + radius * x, circle.y + radius * y);

        }

        if(has_error) {
            errors++;
        }

    }

    ctx.fill();
    ctx.stroke();

    console.log('complete for', performance.now() - p, 'errors:', Math.round(errors/10000*100*10000)/10000 + '%')

});