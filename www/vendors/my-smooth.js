export class MySmooth {

    constructor(xs, ys) {
        this.xs = xs;
        this.ys = ys;
        //
        this.xmin = Math.min.apply(Math, xs);
        this.xmax = Math.max.apply(Math, xs);
        this.xran = this.xmax - this.xmin;
        //
        this.ymin = Math.min.apply(Math, ys);
        this.ymax = Math.max.apply(Math, ys);
        this.yran = (this.ymax - this.ymin) * 4;
        //
        this.matrix = new Array(this.yran);
        let temp_matrix = new Array(this.yran);
        // linear interpolation
        let sz = this.xran / this.yran;
        let y = 0;
        for(let i = 0; i < ys.length - 1; i++) {
            let xdist = xs[i + 1] - xs[i];
            let ydist = ys[i + 1] - ys[i];
            for(let j = 0; j < xdist; j += sz) {
                this.matrix[y++] = ys[i] + ydist * (j / xdist)
            }
        }
        // smooth
        const getM = (i) => {
            if(i < 0) i = 0;
            if(i >= this.yran) i = this.yran - 1;
            return this.matrix[i];
        };
        for(let z = 0; z < 2; z++) {
            temp_matrix[0] = this.matrix[0];
            temp_matrix[this.yran - 1] = this.matrix[this.yran - 1];
            for(let i = 1; i < this.yran - 1; i++) {
                let sum = 0;
                let cnt = 0;
                for(let j = -10; j <= 10; j++) {
                    sum += getM(i + j);
                    cnt++;
                }
                temp_matrix[i] = sum / cnt;
            }
            this.matrix = temp_matrix;
        }
        // console.table(this.matrix)
    }

    at(value) {
        let index = (value - this.xmin) / this.xran;
        if(index < 0) index = 0;
        if(index >= this.yran) index = this.yran - 1;
        index = Math.round(index * (this.yran - 1));
        return this.matrix[index];
    }

}