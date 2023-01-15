import glMatrix from '../../vendors/gl-matrix-3.3.min.js';

const {mat3, vec3} = glMatrix;

const length = (a) => Math.sqrt(a * a)
const fract = (a) => a - Math.floor(a)
const min = Math.min
const pow = Math.pow

export class EnchantShaderNoise {

    constructor() {
        this.m = mat3.clone([-2, -1, 2, 3, -2, 1, 1, 2, 2]);
        mat3.transpose(this.m, this.m);
        this.a = vec3.create();
        this.b = vec3.create();
        this.c1 = vec3.create();
        this.k = vec3.create();
    }

    apply(out, offset1, input, offset2, px, py, u_time) {

        px *= 2.56
        py *= 2.56

        const {a, b, c1, k, m} = this;

        a[0] = px / 4e2;
        a[1] = py / 4e2;
        a[2] = (u_time / 1000) / 4;

        vec3.transformMat3(a, a, m);
        vec3.transformMat3(b, a, m);
        vec3.transformMat3(c1, b, m);
        b[0] *= .4;
        b[1] *= .4;
        b[2] *= .4;
        c1[0] *= .3;
        c1[1] *= .3;
        c1[2] *= .3;

        k[0] = k[0] = pow(
            min(min(   length(.5 - fract(a[0])), 
                       length(.5 - fract(b[0]))
                    ), length(.5 - fract(c1[0])
               )), 7.) * 25.;
        // k[1] = Math.pow(Math.min(.5 - (a[1] - Math.floor(a[1])),
        //     .5 - (b[1] - Math.floor(b[1])),
        //     .5 - (c1[1] - Math.floor(c1[1])),
        // ), 7.) * 25.0;
        k[2] = pow(
            min(min(   length(.5 - fract(a[2])), 
                       length(.5 - fract(b[2]))
                    ), length(.5 - fract(c1[2])
               )), 7.) * 25.;
        out[offset1 + 0] = input[offset2 + 0] + Math.round(k[0] * 1.5 * 255.0);
        out[offset1 + 2] = input[offset2 + 2] + Math.round(k[2] * 6. * 255.0);
    }
}