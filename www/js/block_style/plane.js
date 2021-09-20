// push_plane
export function push_plane(vertices, x, y, z, c, lm, ao, x_dir, rot, xp, yp, zp, flags) {

    z = [y, y = z][0];
    zp = [yp, yp = zp][0];

    xp          = xp ? xp : 1; // rot ? 1.41 : 1.0;
    yp          = yp ? yp : 1; // rot ? 1.41 : 1.0;
    zp          = zp ? zp : 1; // rot ? 1.41 : 1.0;
    flags = flags || 0;

    if (x_dir) {
        if(rot) {
            vertices.push(x + xp/2, y + yp/2, z + zp/2,
                xp, yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                ...ao, flags);
            vertices.push(x + xp/2, y + yp/2, z + zp/2,
                -xp, yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                ...ao, flags);
        } else {
            vertices.push(x + xp/2, y + 0.5, z + zp/2,
                xp, 0, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                ...ao, flags);
            vertices.push(x + xp/2, y + 0.5, z + zp/2,
                -xp, 0, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                ...ao, flags);
        }
    } else {
        if(rot) {
            vertices.push(x + xp/2, y + yp/2, z + zp/2,
                -xp, -yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                ...ao, flags);
            vertices.push(x + xp/2, y + yp/2, z + zp/2,
                xp, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                ...ao, flags);
        } else {
            vertices.push(x + 0.5, y + yp/2, z + zp/2,
                0, yp, 0,
                0, 0, -zp,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                ...ao, flags);
            vertices.push(x + 0.5, y + yp/2, z + zp/2,
                0, -yp, 0,
                0, 0, -zp,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                ...ao, flags);
        }
    }

}