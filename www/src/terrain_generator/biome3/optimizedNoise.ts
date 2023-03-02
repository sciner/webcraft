const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;
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
        let X0 = 0;
        let x0 = 0; // The x,y,z distances from the cell origin
        // optimize values;
        let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
        let u0 = 0, u1 = 0, u2 = 0, u3 = 0;
        let v0 = 0, v1 = 0, v2 = 0, v3 = 0;
        let i1 = 0; // Offsets for second corner of simplex in (i,j,k) coords
        let i2 = 0; // Offsets for third corner of simplex in (i,j,k) coords
        for (let ind = 0; ind < xCount; ind++) {
            x = xStart + xStep * ind;
            if (lastX - (1e-3) < x) {
                const s = (y + z) * F3; // Very nice and simple skew factor for 3D
                const i = fastFloor(x * (1.0 + F3) + s);
                const j = fastFloor(y + x * F3 + s);
                const k = fastFloor(z + x * F3 + s);
                const t = (i + j + k) * G3;
                X0 = i - t; // Unskew the cell origin back to (x,y,z) space
                const Y0 = j - t;
                const Z0 = k - t;

                const a = (i + 1 - s) / ( 1 + F3);
                const b = (j + 1 - s - y) / ( F3);
                const c = (k + 1 - s - z) / ( F3);
                if (a < b) {
                    if (a < c) {
                        lastX = a;
                    } else {
                        lastX = c;
                    }
                } else {
                    if (b < c) {
                        lastX = b;
                    } else {
                        lastX = c;
                    }
                }

                x0 = x - X0;
                const y0 = y - Y0;
                const z0 = z - Z0;
                //x0 derivative is 1
                if (y0 > x0) {
                    if (lastX > (y0 - x0) + x) {
                        lastX = y0 - x0 + x;
                    }
                }
                if (z0 > x0) {
                    if (lastX > (z0 - x0) + x) {
                        lastX = z0 - x0 + x;
                    }
                }
                // if (lastX < x) {
                //     throw new Error('bad error');
                // }
                let j1 = 0, k1 = 0, j2 = 0, k2 = 0;
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
                // Work out the hashed gradient indices of the four simplex corners
                const ii = i & 255;
                const jj = j & 255;
                const kk = k & 255;


                const y1 = y0 - j1 + G3;
                const z1 = z0 - k1 + G3;
                const y2 = y0 - j2 + 2.0 * G3;
                const z2 = z0 - k2 + 2.0 * G3;
                const y3 = y0 - 1.0 + 3.0 * G3;
                const z3 = z0 - 1.0 + 3.0 * G3;

                u0 = y0 * y0 + z0 * z0;
                u1 = y1 * y1 + z1 * z1;
                u2 = y2 * y2 + z2 * z2;
                u3 = y3 * y3 + z3 * z3;

                if (u0 < 0.6) {
                    const gi0 = ii + perm[jj + perm[kk]];
                    p0 = permGrad3x[gi0];
                    v0 = permGrad3y[gi0] * y0 + permGrad3z[gi0] * z0;
                }
                if (u1 < 0.6) {
                    const gi1 = ii + i1 + perm[jj + j1 + perm[kk + k1]];
                    p1 = permGrad3x[gi1];
                    v1 = permGrad3y[gi1] * y1 + permGrad3z[gi1] * z1;
                }
                if (u2 < 0.6) {
                    const gi2 = ii + i2 + perm[jj + j2 + perm[kk + k2]];
                    p2 = permGrad3x[gi2];
                    v2 = permGrad3y[gi2] * y2 + permGrad3z[gi2] * z2;
                }
                if (u3 < 0.6) {
                    const gi3 = ii + 1 + perm[jj + 1 + perm[kk + 1]];
                    p3 = permGrad3x[gi3];
                    v3 = permGrad3y[gi3] * y3 + permGrad3z[gi3] * z3;
                }
            }
            let n0, n1, n2, n3; // Noise contributions from the four corners
            // Skew the input space to determine which simplex cell we're in
            x0 = x - X0;
            // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
            // Determine which simplex we are in.
            // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
            // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
            // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
            // c = 1/6.
            const x1 = x0 - i1 + G3; // Offsets for second corner in (x,y,z) coords
            const x2 = x0 - i2 + 2.0 * G3; // Offsets for third corner in (x,y,z) coords
            const x3 = x0 - 1.0 + 3.0 * G3; // Offsets for last corner in (x,y,z) coords

            // Calculate the contribution from the four corners
            let t0 = 0.6 - x0 * x0 - u0;
            if (t0 < 0) n0 = 0.0;
            else {
                t0 *= t0;
                n0 = t0 * t0 * (p0 * x0 + v0);
            }
            let t1 = 0.6 - x1 * x1 - u1;
            if (t1 < 0) n1 = 0.0;
            else {
                t1 *= t1;
                n1 = t1 * t1 * (p1 * x1 + v1);
            }
            let t2 = 0.6 - x2 * x2 - u2;
            if (t2 < 0) n2 = 0.0;
            else {
                t2 *= t2;
                n2 = t2 * t2 * (p2 * x2 + v2);
            }
            let t3 = 0.6 - x3 * x3 - u3;
            if (t3 < 0) n3 = 0.0;
            else {
                t3 *= t3;
                n3 = t3 * t3 * (p3 * x3 + v3);
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