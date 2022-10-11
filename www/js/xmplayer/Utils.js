export function ConvertSample(array, bits) {
    var len = array.length;
    var acc = 0;
    var samp, b, k;
    if (bits === 0) {  // 8 bit sample
        samp = new Float32Array(len);
        for (k = 0; k < len; k++) {
            acc += array[k];
            b = acc & 255;
            if (b & 128) b = b - 256;
            samp[k] = b / 128.0;
        }
        return samp;
    } else {
        len /= 2;
        samp = new Float32Array(len);
        for (k = 0; k < len; k++) {
            b = array[k * 2] + (array[k * 2 + 1] << 8);
            if (b & 32768) b = b - 65536;
            acc = Math.max(-1, Math.min(1, acc + b / 32768.0));
            samp[k] = acc;
        }
        return samp;
    }
}

export function GetString(dv, offset, len) {
    var str = [];
    for (var i = offset; i < offset + len; i++) {
        var c = dv.getUint8(i);
        if (c === 0) break;
        str.push(String.fromCharCode(c));
    }
    return str.join('');
}

// optimization: unroll short sample loops so we can run our inner mixing loop
// uninterrupted for as long as possible; this also handles pingpong loops.
export function UnrollSampleLoop(samp) {
    var nloops = ((2048 + samp.looplen - 1) / samp.looplen) | 0;
    var pingpong = samp.type & 2;
    if (pingpong) {
        // make sure we have an even number of loops if we are pingponging
        nloops = (nloops + 1) & (~1);
    }
    var samplesiz = samp.loop + nloops * samp.looplen;
    var data = new Float32Array(samplesiz);
    for (var i = 0; i < samp.loop; i++) {
        data[i] = samp.sampledata[i];
    }
    for (var j = 0; j < nloops; j++) {
        var k;
        if ((j & 1) && pingpong) {
            for (k = samp.looplen - 1; k >= 0; k--) {
                data[i++] = samp.sampledata[samp.loop + k];
            }
        } else {
            for (k = 0; k < samp.looplen; k++) {
                data[i++] = samp.sampledata[samp.loop + k];
            }
        }
    }
    console.debug("unrolled sample loop; looplen", samp.looplen, "x", nloops, " = ", samplesiz);
    samp.sampledata = data;
    samp.looplen = nloops * samp.looplen;
    samp.type = 1;
}