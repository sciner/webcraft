const F2 = /*#__PURE__*/ 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = /*#__PURE__*/ (3.0 - Math.sqrt(3.0)) / 6.0;
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;
const F4 = /*#__PURE__*/ (Math.sqrt(5.0) - 1.0) / 4.0;
const G4 = /*#__PURE__*/ (5.0 - Math.sqrt(5.0)) / 20.0;

// I'm really not sure why this | 0 (basically a coercion to int)
// is making this faster but I get ~5 million ops/sec more on the
// benchmarks across the board or a ~10% speedup.
const fastFloor = (x) => Math.floor(x) | 0;

// double seems to be faster than single or int's
// probably because most operations are in double precision
const grad3 = /*#__PURE__*/ new Float64Array([1, 1, 0,
    -1, 1, 0,
    1, -1, 0,

    -1, -1, 0,
    1, 0, 1,
    -1, 0, 1,

    1, 0, -1,
    -1, 0, -1,
    0, 1, 1,

    0, -1, 1,
    0, 1, -1,
    0, -1, -1]);

export function createNoise3DOpt(random = Math.random) {
    const perm = buildPermutationTable(random);
    // precalculating these seems to yield a speedup of over 15%
    const permGrad3x = new Float64Array(perm).map(v => grad3[(v % 12) * 3]);
    const permGrad3y = new Float64Array(perm).map(v => grad3[(v % 12) * 3 + 1]);
    const permGrad3z = new Float64Array(perm).map(v => grad3[(v % 12) * 3 + 2]);
    return function noise3D(xStart, y, z, xStep, xCount, out, outOffset) {
        let x = xStart;
        let lastX = xStart - 1;
        let i = 0, j = 0, k = 0, t = 0, X0 = 0, Y0 = 0, Z0 = 0;
        for (let ind = 0; ind < xCount; ind++) {
            x = xStart + xStep * ind;
            if (lastX - (1e-3) < x) {
                t = (i + j + k) * G3;
                const s = (y + z) * F3; // Very nice and simple skew factor for 3D
                i = fastFloor(x * (1.0 + F3) + s);
                j = fastFloor(y + x * F3 + s);
                k = fastFloor(z + x * F3 + s);
                X0 = i - t; // Unskew the cell origin back to (x,y,z) space
                Y0 = j - t;
                Z0 = k - t;

                lastX = Math.min(
                    (i + 1 - s) / ( 1 + F3),
                    (j + 1 - s) / F3,
                    (k + 1 - s) / F3,
                    );
            }
            let n0, n1, n2, n3; // Noise contributions from the four corners
            // Skew the input space to determine which simplex cell we're in
            const x0 = x - X0; // The x,y,z distances from the cell origin
            const y0 = y - Y0;
            const z0 = z - Z0;
            // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
            // Determine which simplex we are in.
            let i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
            let i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
            if (x0 >= y0) {
                if (y0 >= z0) {
                    i1 = 1;
                    j1 = 0;
                    k1 = 0;
                    i2 = 1;
                    j2 = 1;
                    k2 = 0;
                } // X Y Z order
                else if (x0 >= z0) {
                    i1 = 1;
                    j1 = 0;
                    k1 = 0;
                    i2 = 1;
                    j2 = 0;
                    k2 = 1;
                } // X Z Y order
                else {
                    i1 = 0;
                    j1 = 0;
                    k1 = 1;
                    i2 = 1;
                    j2 = 0;
                    k2 = 1;
                } // Z X Y order
            } else { // x0<y0
                if (y0 < z0) {
                    i1 = 0;
                    j1 = 0;
                    k1 = 1;
                    i2 = 0;
                    j2 = 1;
                    k2 = 1;
                } // Z Y X order
                else if (x0 < z0) {
                    i1 = 0;
                    j1 = 1;
                    k1 = 0;
                    i2 = 0;
                    j2 = 1;
                    k2 = 1;
                } // Y Z X order
                else {
                    i1 = 0;
                    j1 = 1;
                    k1 = 0;
                    i2 = 1;
                    j2 = 1;
                    k2 = 0;
                } // Y X Z order
            }
            // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
            // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
            // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
            // c = 1/6.
            const x1 = x0 - i1 + G3; // Offsets for second corner in (x,y,z) coords
            const y1 = y0 - j1 + G3;
            const z1 = z0 - k1 + G3;
            const x2 = x0 - i2 + 2.0 * G3; // Offsets for third corner in (x,y,z) coords
            const y2 = y0 - j2 + 2.0 * G3;
            const z2 = z0 - k2 + 2.0 * G3;
            const x3 = x0 - 1.0 + 3.0 * G3; // Offsets for last corner in (x,y,z) coords
            const y3 = y0 - 1.0 + 3.0 * G3;
            const z3 = z0 - 1.0 + 3.0 * G3;
            // Work out the hashed gradient indices of the four simplex corners
            const ii = i & 255;
            const jj = j & 255;
            const kk = k & 255;
            // Calculate the contribution from the four corners
            let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
            if (t0 < 0) n0 = 0.0;
            else {
                const gi0 = ii + perm[jj + perm[kk]];
                t0 *= t0;
                n0 = t0 * t0 * (permGrad3x[gi0] * x0 + permGrad3y[gi0] * y0 + permGrad3z[gi0] * z0);
            }
            let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
            if (t1 < 0) n1 = 0.0;
            else {
                const gi1 = ii + i1 + perm[jj + j1 + perm[kk + k1]];
                t1 *= t1;
                n1 = t1 * t1 * (permGrad3x[gi1] * x1 + permGrad3y[gi1] * y1 + permGrad3z[gi1] * z1);
            }
            let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
            if (t2 < 0) n2 = 0.0;
            else {
                const gi2 = ii + i2 + perm[jj + j2 + perm[kk + k2]];
                t2 *= t2;
                n2 = t2 * t2 * (permGrad3x[gi2] * x2 + permGrad3y[gi2] * y2 + permGrad3z[gi2] * z2);
            }
            let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
            if (t3 < 0) n3 = 0.0;
            else {
                const gi3 = ii + 1 + perm[jj + 1 + perm[kk + 1]];
                t3 *= t3;
                n3 = t3 * t3 * (permGrad3x[gi3] * x3 + permGrad3y[gi3] * y3 + permGrad3z[gi3] * z3);
            }
            // Add contributions from each corner to get the final noise value.
            // The result is scaled to stay just inside [-1,1]
            out[outOffset + ind] = 32.0 * (n0 + n1 + n2 + n3);
        }
    };
}

/**
 * Builds a random permutation table.
 * This is exported only for (internal) testing purposes.
 * Do not rely on this export.
 * @private
 */
export function buildPermutationTable(random) {
    const tableSize = 512;
    const p = new Uint8Array(tableSize);
    for (let i = 0; i < tableSize / 2; i++) {
        p[i] = i;
    }
    for (let i = 0; i < tableSize / 2 - 1; i++) {
        const r = i + ~~(random() * (256 - i));
        const aux = p[i];
        p[i] = p[r];
        p[r] = aux;
    }
    for (let i = 256; i < tableSize; i++) {
        p[i] = p[i - 256];
    }
    return p;
}