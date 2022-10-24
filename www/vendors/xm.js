/**
* FastTracker 2 .XM player, written for fun.
* https://github.com/a1k0n/jsxm
*/

// for pretty-printing notes
const _note_names = [
    "C-", "C#", "D-", "D#", "E-", "F-",
    "F#", "G-", "G#", "A-", "A#", "B-"];

let f_smp = 44100;  // updated by play callback, default value here

// per-sample exponential moving average for volume changes (to prevent pops
// and clicks); evaluated every 8 samples
const popfilter_alpha = 0.9837;

class XMEffects {

    constructor() {

        this.effects_t0 = [  // effect functions on tick 0
            this.eff_t1_0,  // 1, arpeggio is processed on all ticks
            this.eff_t0_1,
            this.eff_t0_2,
            this.eff_t0_3,
            this.eff_t0_4,  // 4
            this.eff_t0_a,  // 5, same as A on first tick
            this.eff_t0_a,  // 6, same as A on first tick
            this.eff_unimplemented_t0,  // 7
            this.eff_t0_8,  // 8
            this.eff_t0_9,  // 9
            this.eff_t0_a,  // a
            this.eff_t0_b,  // b
            this.eff_t0_c,  // c
            this.eff_t0_d,  // d
            this.eff_t0_e,  // e
            this.eff_t0_f,  // f
            this.eff_t0_g,  // g
            this.eff_t0_h,  // h
            this.eff_unimplemented_t0,  // i
            this.eff_unimplemented_t0,  // j
            this.eff_unimplemented_t0,  // k
            this.eff_unimplemented_t0,  // l
            this.eff_unimplemented_t0,  // m
            this.eff_unimplemented_t0,  // n
            this.eff_unimplemented_t0,  // o
            this.eff_unimplemented_t0,  // p
            this.eff_unimplemented_t0,  // q
            this.eff_t0_r,  // r
            this.eff_unimplemented_t0,  // s
            this.eff_unimplemented_t0,  // t
            this.eff_unimplemented_t0,  // u
            this.eff_unimplemented_t0,  // v
            this.eff_unimplemented_t0,  // w
            this.eff_unimplemented_t0,  // x
            this.eff_unimplemented_t0,  // y
            this.eff_unimplemented_t0,  // z
        ];
    
        this.effects_t1 = [  // effect functions on tick 1+
            this.eff_t1_0,
            this.eff_t1_1,
            this.eff_t1_2,
            this.eff_t1_3,
            this.eff_t1_4,
            this.eff_t1_5,  // 5
            this.eff_t1_6,  // 6
            this.eff_unimplemented,  // 7
            null,   // 8
            null,   // 9
            this.eff_t1_a,  // a
            null,   // b
            null,   // c
            null,   // d
            this.eff_t1_e,  // e
            null,   // f
            null,  // g
            this.eff_t1_h,  // h
            this.eff_unimplemented,  // i
            this.eff_unimplemented,  // j
            this.eff_unimplemented,  // k
            this.eff_unimplemented,  // l
            this.eff_unimplemented,  // m
            this.eff_unimplemented,  // n
            this.eff_unimplemented,  // o
            this.eff_unimplemented,  // p
            this.eff_unimplemented,  // q
            this.eff_t1_r,  // r
            this.eff_unimplemented,  // s
            this.eff_unimplemented,  // t
            this.eff_unimplemented,  // u
            this.eff_unimplemented,  // v
            this.eff_unimplemented,  // w
            this.eff_unimplemented,  // x
            this.eff_unimplemented,  // y
            this.eff_unimplemented   // z
        ];

    }

    eff_t1_0(ch) {  // arpeggio
        if (ch.effectdata !== 0 && ch.inst !== undefined) {
            var arpeggio = [0, ch.effectdata >> 4, ch.effectdata & 15];
            var note = ch.note + arpeggio[this.cur_tick % 3];
            ch.period = this.periodForNote(ch, note);
        }
    }

    eff_t0_1(ch, data) {  // pitch slide up
        if (data !== 0) {
            ch.slideupspeed = data;
        }
    }

    eff_t1_1(ch) {  // pitch slide up
        if (ch.slideupspeed !== undefined) {
            // is this limited? it appears not
            ch.period -= ch.slideupspeed;
        }
    }

    eff_t0_2(ch, data) {  // pitch slide down
        if (data !== 0) {
            ch.slidedownspeed = data;
        }
    }

    eff_t1_2(ch) {  // pitch slide down
        if (ch.slidedownspeed !== undefined) {
            // 1728 is the period for C-1
            ch.period = Math.min(1728, ch.period + ch.slidedownspeed);
        }
    }

    eff_t0_3(ch, data) {  // portamento
        if (data !== 0) {
            ch.portaspeed = data;
        }
    }

    eff_t1_3(ch) {  // portamento
        if (ch.periodtarget !== undefined && ch.portaspeed !== undefined) {
            if (ch.period > ch.periodtarget) {
                ch.period = Math.max(ch.periodtarget, ch.period - ch.portaspeed);
            } else {
                ch.period = Math.min(ch.periodtarget, ch.period + ch.portaspeed);
            }
        }
    }

    eff_t0_4(ch, data) {  // vibrato
        if (data & 0x0f) {
            ch.vibratodepth = (data & 0x0f) * 2;
        }
        if (data >> 4) {
            ch.vibratospeed = data >> 4;
        }
        this.eff_t1_4(ch);
    }

    eff_t1_4(ch) {  // vibrato
        ch.periodoffset = this.getVibratoDelta(ch.vibratotype, ch.vibratopos) * ch.vibratodepth;
        if (isNaN(ch.periodoffset)) {
            console.log("vibrato periodoffset NaN?",
                ch.vibratopos, ch.vibratospeed, ch.vibratodepth);
            ch.periodoffset = 0;
        }
        // only updates on non-first ticks
        if (this.cur_tick > 0) {
            ch.vibratopos += ch.vibratospeed;
            ch.vibratopos &= 63;
        }
    }

    getVibratoDelta(type, x) {
        var delta = 0;
        switch (type & 0x03) {
            case 1: // sawtooth (ramp-down)
                delta = ((1 + x * 2 / 64) % 2) - 1;
                break;
            case 2: // square
            case 3: // random (in FT2 these two are the same)
                delta = x < 32 ? 1 : -1;
                break;
            case 0:
            default: // sine
                delta = Math.sin(x * Math.PI / 32);
                break;
        }
        return delta;
    }

    eff_t1_5(ch) {  // portamento + volume slide
        this.eff_t1_a(ch);
        this.eff_t1_3(ch);
    }

    eff_t1_6(ch) {  // vibrato + volume slide
        this.eff_t1_a(ch);
        this.eff_t1_4(ch);
    }

    eff_t0_8(ch, data) {  // set panning
        ch.pan = data;
    }

    eff_t0_9(ch, data) {  // sample offset
        ch.off = data * 256;
    }

    eff_t0_a(ch, data) {  // volume slide
        if (data) {
            ch.volumeslide = -(data & 0x0f) + (data >> 4);
        }
    }

    eff_t1_a(ch) {  // volume slide
        if (ch.volumeslide !== undefined) {
            ch.vol = Math.max(0, Math.min(64, ch.vol + ch.volumeslide));
        }
    }

    eff_t0_b(ch, data) {  // song jump (untested)
        if (data < this.xm.songpats.length) {
            this.cur_songpos = data;
            this.cur_pat = this.xm.songpats[this.cur_songpos];
            this.cur_row = -1;
        }
    }

    eff_t0_c(ch, data) {  // set volume
        ch.vol = Math.min(64, data);
    }

    eff_t0_d(ch, data) {  // pattern jump
        this.cur_songpos++;
        if (this.cur_songpos >= this.xm.songpats.length)
        this.cur_songpos = this.xm.song_looppos;
        this.cur_pat = this.xm.songpats[this.cur_songpos];
        this.cur_row = (data >> 4) * 10 + (data & 0x0f) - 1;
    }

    eff_t0_e(ch, data) {  // extended effects!
        var eff = data >> 4;
        data = data & 0x0f;
        switch (eff) {
            case 1:  // fine porta up
                ch.period -= data;
                break;
            case 2:  // fine porta down
                ch.period += data;
                break;
            case 4:  // set vibrato waveform
                ch.vibratotype = data & 0x07;
                break;
            case 5:  // finetune
                ch.fine = (data << 4) + data - 128;
                break;
            case 8:  // panning
                ch.pan = data * 0x11;
                break;
            case 0x0a:  // fine vol slide up (with memory)
                if (data === 0 && ch.finevolup !== undefined)
                    data = ch.finevolup;
                ch.vol = Math.min(64, ch.vol + data);
                ch.finevolup = data;
                break;
            case 0x0b:  // fine vol slide down
                if (data === 0 && ch.finevoldown !== undefined)
                    data = ch.finevoldown;
                ch.vol = Math.max(0, ch.vol - data);
                ch.finevoldown = data;
                break;
            case 0x0c:  // note cut handled in eff_t1_e
                break;
            default:
                console.debug("unimplemented extended effect E", ch.effectdata.toString(16));
                break;
        }
    }

    eff_t1_e(ch) {  // note cut
        switch (ch.effectdata >> 4) {
            case 0x0c:
                if (this.cur_tick == (ch.effectdata & 0x0f)) {
                    ch.vol = 0;
                }
                break;
        }
    }

    eff_t0_f(ch, data) {  // set tempo
        if (data === 0) {
            console.log("tempo 0?");
            return;
        } else if (data < 0x20) {
            console.log(this);
            this.xm.tempo = data;
        } else {
            this.xm.bpm = data;
        }
    }

    eff_t0_g(ch, data) {  // set global volume
        if (data <= 0x40) {
            // volume gets multiplied by 2 to match
            // the initial max global volume of 128
            this.xm.global_volume = Math.max(0, data * 2);
        } else {
            this.xm.global_volume = this.max_global_volume;
        }
    }

    eff_t0_h(ch, data) {  // global volume slide
        if (data) {
            // same as Axy but multiplied by 2
            this.xm.global_volumeslide = (-(data & 0x0f) + (data >> 4)) * 2;
        }
    }

    eff_t1_h(ch) {  // global volume slide
        if (this.xm.global_volumeslide !== undefined) {
            this.xm.global_volume = Math.max(0, Math.min(this.max_global_volume,
                this.xm.global_volume + this.xm.global_volumeslide));
        }
    }

    eff_t0_r(ch, data) {  // retrigger
        if (data & 0x0f) ch.retrig = (ch.retrig & 0xf0) + (data & 0x0f);
        if (data & 0xf0) ch.retrig = (ch.retrig & 0x0f) + (data & 0xf0);

        // retrigger volume table
        switch (ch.retrig >> 4) {
            case 1: ch.vol -= 1; break;
            case 2: ch.vol -= 2; break;
            case 3: ch.vol -= 4; break;
            case 4: ch.vol -= 8; break;
            case 5: ch.vol -= 16; break;
            case 6: ch.vol *= 2; ch.vol /= 3; break;
            case 7: ch.vol /= 2; break;
            case 9: ch.vol += 1; break;
            case 0x0a: ch.vol += 2; break;
            case 0x0b: ch.vol += 4; break;
            case 0x0c: ch.vol += 8; break;
            case 0x0d: ch.vol += 16; break;
            case 0x0e: ch.vol *= 3; ch.vol /= 2; break;
            case 0x0f: ch.vol *= 2; break;
        }
        ch.vol = Math.min(64, Math.max(0, ch.vol));
    }

    eff_t1_r(ch) {
        if (this.cur_tick % (ch.retrig & 0x0f) === 0) {
            ch.off = 0;
        }
    }

    eff_unimplemented() {}

    eff_unimplemented_t0(ch, data) {
        console.log("unimplemented effect", this.prettify_effect(ch.effect, data));
    }

}

class Envelope {
    
    constructor(points, type, sustain, loopstart, loopend) {
        this.points = points;
        this.type = type;
        this.sustain = sustain;
        this.loopstart = points[loopstart * 2];
        this.loopend = points[loopend * 2];
    }

    Get(ticks) {
        // TODO: optimize follower with ptr
        // or even do binary search here
        var y0;
        var env = this.points;
        for (var i = 0; i < env.length; i += 2) {
            y0 = env[i + 1];
            if (ticks < env[i]) {
                var x0 = env[i - 2];
                y0 = env[i - 1];
                var dx = env[i] - x0;
                var dy = env[i + 1] - y0;
                return y0 + (ticks - x0) * dy / dx;
            }
        }
        return y0;
    }

}

class EnvelopeFollower {

    constructor(env) {
        this.env = env;
        this.tick = 0;
    }

    Tick(release) {
        var value = this.env.Get(this.tick);
    
        // if we're sustaining a note, stop advancing the tick counter
        if (!release && this.tick >= this.env.points[this.env.sustain * 2]) {
            return this.env.points[this.env.sustain * 2 + 1];
        }
    
        this.tick++;
        if (this.env.type & 4) {  // envelope loop?
            if (!release &&
                this.tick >= this.env.loopend) {
                this.tick -= this.env.loopend - this.env.loopstart;
            }
        }
        return value;
    }

}

export class XMPlayer extends XMEffects {

    constructor() {
        super();
        this.playing            = false;
        this.XMView             = {};
        this.cur_songpos        = -1;
        this.cur_pat            = -1;
        this.cur_row            = 64;
        this.cur_ticksamp       = 0;
        this.cur_tick           = 6;
        this.xm                 = {};  // contains all song data
        this.xm.global_volume   = this.max_global_volume = 128;
        // this.Envelope = Envelope;
    }

    prettify_note(note) {
        if (note < 0) return "---";
        if (note == 96) return "^^^";
        return _note_names[note % 12] + ~~(note / 12);
    }

    prettify_number(num) {
        if (num == -1) return "--";
        if (num < 10) return "0" + num;
        return num;
    }

    prettify_volume(num) {
        if (num < 0x10) return "--";
        return num.toString(16);
    }

    prettify_effect(t, p) {
        if (t >= 10) t = String.fromCharCode(55 + t);
        if (p < 16) p = '0' + p.toString(16);
        else p = p.toString(16);
        return t + p;
    }

    prettify_notedata(data) {
        return (this.prettify_note(data[0]) + " " + this.prettify_number(data[1]) + " " +
            this.prettify_volume(data[2]) + " " +
            this.prettify_effect(data[3], data[4]));
    }

    getstring(dv, offset, len) {
        var str = [];
        for (var i = offset; i < offset + len; i++) {
            var c = dv.getUint8(i);
            if (c === 0) break;
            str.push(String.fromCharCode(c));
        }
        return str.join('');
    }

    // Return 2-pole Butterworth lowpass filter coefficients for
    // center frequncy f_c (relative to sampling frequency)
    filterCoeffs(f_c) {
        if (f_c > 0.5) {  // we can't lowpass above the nyquist frequency...
            f_c = 0.5;
        }
        var wct = Math.sqrt(2) * Math.PI * f_c;
        var e = Math.exp(-wct);
        var c = e * Math.cos(wct);
        var gain = (1 - 2 * c + e * e) / 2;
        return [gain, 2 * c, -e * e];
    }

    updateChannelPeriod(ch, period) {
        var freq = 8363 * Math.pow(2, (1152.0 - period) / 192.0);
        if (isNaN(freq)) {
            console.debug("invalid period!", period);
            return;
        }
        ch.doff = freq / f_smp;
        ch.filter = this.filterCoeffs(ch.doff / 2);
    }

    periodForNote(ch, note) {
        return 1920 - (note + ch.samp.note) * 16 - ch.fine / 8.0;
    }

    setCurrentPattern() {
        var nextPat = this.xm.songpats[this.cur_songpos];

        // check for out of range pattern index
        while (nextPat >= this.xm.patterns.length) {
            if (this.cur_songpos + 1 < this.xm.songpats.length) {
                // first try skipping the position
                this.cur_songpos++;
            } else if ((this.cur_songpos === this.xm.song_looppos && this.cur_songpos !== 0)
                || this.xm.song_looppos >= this.xm.songpats.length) {
                // if we allready tried song_looppos or if song_looppos
                // is out of range, go to the first position
                this.cur_songpos = 0;
            } else {
                // try going to song_looppos
                this.cur_songpos = this.xm.song_looppos;
            }

            nextPat = this.xm.songpats[this.cur_songpos];
        }

        this.cur_pat = nextPat;
    }

    nextRow() {
        if (typeof this.next_row === "undefined") { this.next_row = this.cur_row + 1; }
        this.cur_row = this.next_row;
        this.next_row++;

        if (this.cur_pat == -1 || this.cur_row >= this.xm.patterns[this.cur_pat].length) {
            this.cur_row = 0;
            this.next_row = 1;
            this.cur_songpos++;
            if (this.cur_songpos >= this.xm.songpats.length)
            this.cur_songpos = this.xm.song_looppos;
            this.setCurrentPattern();
        }
        var p = this.xm.patterns[this.cur_pat];
        var r = p[this.cur_row];
        for (var i = 0; i < r.length; i++) {
            var ch = this.xm.channelinfo[i];
            var inst = ch.inst;
            var triggernote = false;
            // instrument trigger
            if (r[i][1] != -1) {
                inst = this.xm.instruments[r[i][1] - 1];
                if (inst && inst.samplemap) {
                    ch.inst = inst;
                    // retrigger unless overridden below
                    triggernote = true;
                    if (ch.note && inst.samplemap) {
                        ch.samp = inst.samples[inst.samplemap[ch.note]];
                        ch.vol = ch.samp.vol;
                        ch.pan = ch.samp.pan;
                        ch.fine = ch.samp.fine;
                    }
                } else {
                    // console.debug("invalid inst", r[i][1], instruments.length);
                }
            }

            // note trigger
            if (r[i][0] != -1) {
                if (r[i][0] == 96) {
                    ch.release = 1;
                    triggernote = false;
                } else {
                    if (inst && inst.samplemap) {
                        var note = r[i][0];
                        ch.note = note;
                        ch.samp = inst.samples[inst.samplemap[ch.note]];
                        if (triggernote) {
                            // if we were already triggering the note, reset vol/pan using
                            // (potentially) new sample
                            ch.pan = ch.samp.pan;
                            ch.vol = ch.samp.vol;
                            ch.fine = ch.samp.fine;
                        }
                        triggernote = true;
                    }
                }
            }

            ch.voleffectfn = undefined;
            if (r[i][2] != -1) {  // volume column
                var v = r[i][2];
                ch.voleffectdata = v & 0x0f;
                if (v < 0x10) {
                    console.debug("channel", i, "invalid volume", v.toString(16));
                } else if (v <= 0x50) {
                    ch.vol = v - 0x10;
                } else if (v >= 0x60 && v < 0x70) {  // volume slide down
                    ch.voleffectfn = function (ch) {
                        ch.vol = Math.max(0, ch.vol - ch.voleffectdata);
                    };
                } else if (v >= 0x70 && v < 0x80) {  // volume slide up
                    ch.voleffectfn = function (ch) {
                        ch.vol = Math.min(64, ch.vol + ch.voleffectdata);
                    };
                } else if (v >= 0x80 && v < 0x90) {  // fine volume slide down
                    ch.vol = Math.max(0, ch.vol - (v & 0x0f));
                } else if (v >= 0x90 && v < 0xa0) {  // fine volume slide up
                    ch.vol = Math.min(64, ch.vol + (v & 0x0f));
                } else if (v >= 0xa0 && v < 0xb0) {  // vibrato speed
                    ch.vibratospeed = v & 0x0f;
                } else if (v >= 0xb0 && v < 0xc0) {  // vibrato w/ depth
                    ch.vibratodepth = v & 0x0f;
                    ch.voleffectfn = (e) => { this.effects_t1[4]};  // use vibrato effect directly
                    this.effects_t1[4](ch);  // and also call it on tick 0
                } else if (v >= 0xc0 && v < 0xd0) {  // set panning
                    ch.pan = (v & 0x0f) * 0x11;
                } else if (v >= 0xf0 && v <= 0xff) {  // portamento
                    if (v & 0x0f) {
                        ch.portaspeed = (v & 0x0f) << 4;
                    }
                    ch.voleffectfn = (e) => { this.effects_t1[3]};  // just run 3x0
                } else {
                    console.debug("channel", i, "volume effect", v.toString(16));
                }
            }

            ch.effect = r[i][3];
            ch.effectdata = r[i][4];
            if (ch.effect < 36) {
                ch.effectfn = (e) => { this.effects_t1[ch.effect]};
                var eff_t0 = (e) => { this.effects_t0[ch.effect]};
                if (eff_t0 && eff_t0(ch, ch.effectdata)) {
                    triggernote = false;
                }
            } else {
                console.debug("channel", i, "effect > 36", ch.effect);
            }

            // special handling for portamentos: don't trigger the note
            if (ch.effect == 3 || ch.effect == 5 || r[i][2] >= 0xf0) {
                if (r[i][0] != -1) {
                    ch.periodtarget = this.periodForNote(ch, ch.note);
                }
                triggernote = false;
                if (inst && inst.samplemap) {
                    if (ch.env_vol == undefined) {
                        // note wasn't already playing; we basically have to ignore the
                        // portamento and just trigger
                        triggernote = true;
                    } else if (ch.release) {
                        // reset envelopes if note was released but leave offset/pitch/etc
                        // alone
                        ch.envtick = 0;
                        ch.release = 0;
                        ch.env_vol = new EnvelopeFollower(inst.env_vol);
                        ch.env_pan = new EnvelopeFollower(inst.env_pan);
                    }
                }
            }

            if (triggernote) {
                // there's gotta be a less hacky way to handle offset commands...
                if (ch.effect != 9) ch.off = 0;
                ch.release = 0;
                ch.envtick = 0;
                ch.env_vol = new EnvelopeFollower(inst.env_vol);
                ch.env_pan = new EnvelopeFollower(inst.env_pan);
                if (ch.note) {
                    ch.period = this.periodForNote(ch, ch.note);
                }
                // waveforms 0-3 are retriggered on new notes while 4-7 are continuous
                if (ch.vibratotype < 4) {
                    ch.vibratopos = 0;
                }
            }
        }
    }

    nextTick() {
        this.cur_tick++;
        var j, ch;
        for (j = 0; j < this.xm.nchan; j++) {
            ch = this.xm.channelinfo[j];
            ch.periodoffset = 0;
        }
        if (this.cur_tick >= this.xm.tempo) {
            this.cur_tick = 0;
            this.nextRow();
        }
        for (j = 0; j < this.xm.nchan; j++) {
            ch = this.xm.channelinfo[j];
            var inst = ch.inst;
            if (this.cur_tick !== 0) {
                if (ch.voleffectfn) ch.voleffectfn(ch);
                if (ch.effectfn) ch.effectfn(ch);
            }
            if (isNaN(ch.period)) {
                console.debug(this.prettify_notedata(
                    this.xm.patterns[this.cur_pat][this.cur_row][j]),
                    "set channel", j, "period to NaN");
            }
            if (inst === undefined) continue;
            if (ch.env_vol === undefined) {
                console.debug(this.prettify_notedata(
                    this.xm.patterns[this.cur_pat][this.cur_row][j]),
                    "set channel", j, "env_vol to undefined, but note is playing");
                continue;
            }
            ch.volE = ch.env_vol.Tick(ch.release);
            ch.panE = ch.env_pan.Tick(ch.release);
            this.updateChannelPeriod(ch, ch.period + ch.periodoffset);
        }
    }

    // This function gradually brings the channel back down to zero if it isn't
    // already to avoid clicks and pops when samples end.
    MixSilenceIntoBuf(ch, start, end, dataL, dataR) {
        var s = ch.filterstate[1];
        if (isNaN(s)) {
            console.debug("NaN filterstate?", ch.filterstate, ch.filter);
            return;
        }
        for (var i = start; i < end; i++) {
            if (Math.abs(s) < 1.526e-5) {  // == 1/65536.0
                s = 0;
                break;
            }
            dataL[i] += s * ch.vL;
            dataR[i] += s * ch.vR;
            s *= popfilter_alpha;
        }
        ch.filterstate[1] = s;
        ch.filterstate[2] = s;
        if (isNaN(s)) {
            console.debug("NaN filterstate after adding silence?", ch.filterstate, ch.filter, i);
            return;
        }
        return 0;
    }

    MixChannelIntoBuf(ch, start, end, dataL, dataR) {
        var inst = ch.inst;
        var instsamp = ch.samp;
        var loop = false;
        var looplen = 0, loopstart = 0;

        // nothing on this channel, just filter the last dc offset back down to zero
        if (instsamp == undefined || inst == undefined || ch.mute) {
            return this.MixSilenceIntoBuf(ch, start, end, dataL, dataR);
        }

        var samp = instsamp.sampledata;
        var sample_end = instsamp.len;
        if ((instsamp.type & 3) == 1 && instsamp.looplen > 0) {
            loop = true;
            loopstart = instsamp.loop;
            looplen = instsamp.looplen;
            sample_end = loopstart + looplen;
        }
        var samplen = instsamp.len;
        var volE = ch.volE / 64.0;    // current volume envelope
        var panE = 4 * (ch.panE - 32);  // current panning envelope
        var p = panE + ch.pan - 128;  // final pan
        var volL = this.xm.global_volume * volE * (128 - p) * ch.vol / (64 * 128 * 128);
        var volR = this.xm.global_volume * volE * (128 + p) * ch.vol / (64 * 128 * 128);
        if (volL < 0) volL = 0;
        if (volR < 0) volR = 0;
        if (volR === 0 && volL === 0)
            return;
        if (isNaN(volR) || isNaN(volL)) {
            console.debug("NaN volume!?", ch.number, volL, volR, volE, panE, ch.vol);
            return;
        }
        var k = ch.off;
        var dk = ch.doff;
        var Vrms = 0;
        var f0 = ch.filter[0], f1 = ch.filter[1], f2 = ch.filter[2];
        var fs0 = ch.filterstate[0], fs1 = ch.filterstate[1], fs2 = ch.filterstate[2];

        // we also low-pass filter volume changes with a simple one-zero,
        // one-pole filter to avoid pops and clicks when volume changes.
        var vL = popfilter_alpha * ch.vL + (1 - popfilter_alpha) * (volL + ch.vLprev) * 0.5;
        var vR = popfilter_alpha * ch.vR + (1 - popfilter_alpha) * (volR + ch.vRprev) * 0.5;
        var pf_8 = Math.pow(popfilter_alpha, 8);
        ch.vLprev = volL;
        ch.vRprev = volR;

        // we can mix up to this many bytes before running into a sample end/loop
        var i = start;
        var failsafe = 100;
        while (i < end) {
            if (failsafe-- === 0) {
                console.debug("failsafe in mixing loop! channel", ch.number, k, sample_end,
                    loopstart, looplen, dk);
                break;
            }
            if (k >= sample_end) {  // TODO: implement pingpong looping
                if (loop) {
                    k = loopstart + (k - loopstart) % looplen;
                } else {
                    // kill sample
                    ch.inst = undefined;
                    // fill rest of buf with filtered dc offset using loop above
                    return Vrms + this.MixSilenceIntoBuf(ch, i, end, dataL, dataR);
                }
            }
            var next_event = Math.max(1, Math.min(end, i + (sample_end - k) / dk));
            // this is the inner loop of the player

            // unrolled 8x
            var s, y;
            for (; i + 7 < next_event; i += 8) {
                s = samp[k | 0];
                y = f0 * (s + fs0) + f1 * fs1 + f2 * fs2;
                fs2 = fs1; fs1 = y; fs0 = s;
                k += dk;
                dataL[i] += vL * y;
                dataR[i] += vR * y;
                Vrms += (vL + vR) * y * y;

                s = samp[k | 0];
                y = f0 * (s + fs0) + f1 * fs1 + f2 * fs2;
                fs2 = fs1; fs1 = y; fs0 = s;
                k += dk;
                dataL[i + 1] += vL * y;
                dataR[i + 1] += vR * y;
                Vrms += (vL + vR) * y * y;

                s = samp[k | 0];
                y = f0 * (s + fs0) + f1 * fs1 + f2 * fs2;
                fs2 = fs1; fs1 = y; fs0 = s;
                k += dk;
                dataL[i + 2] += vL * y;
                dataR[i + 2] += vR * y;
                Vrms += (vL + vR) * y * y;

                s = samp[k | 0];
                y = f0 * (s + fs0) + f1 * fs1 + f2 * fs2;
                fs2 = fs1; fs1 = y; fs0 = s;
                k += dk;
                dataL[i + 3] += vL * y;
                dataR[i + 3] += vR * y;
                Vrms += (vL + vR) * y * y;

                s = samp[k | 0];
                y = f0 * (s + fs0) + f1 * fs1 + f2 * fs2;
                fs2 = fs1; fs1 = y; fs0 = s;
                k += dk;
                dataL[i + 4] += vL * y;
                dataR[i + 4] += vR * y;
                Vrms += (vL + vR) * y * y;

                s = samp[k | 0];
                y = f0 * (s + fs0) + f1 * fs1 + f2 * fs2;
                fs2 = fs1; fs1 = y; fs0 = s;
                k += dk;
                dataL[i + 5] += vL * y;
                dataR[i + 5] += vR * y;
                Vrms += (vL + vR) * y * y;

                s = samp[k | 0];
                y = f0 * (s + fs0) + f1 * fs1 + f2 * fs2;
                fs2 = fs1; fs1 = y; fs0 = s;
                k += dk;
                dataL[i + 6] += vL * y;
                dataR[i + 6] += vR * y;
                Vrms += (vL + vR) * y * y;

                s = samp[k | 0];
                y = f0 * (s + fs0) + f1 * fs1 + f2 * fs2;
                fs2 = fs1; fs1 = y; fs0 = s;
                k += dk;
                dataL[i + 7] += vL * y;
                dataR[i + 7] += vR * y;
                Vrms += (vL + vR) * y * y;

                vL = pf_8 * vL + (1 - pf_8) * volL;
                vR = pf_8 * vR + (1 - pf_8) * volR;
            }

            for (; i < next_event; i++) {
                s = samp[k | 0];
                // we low-pass filter here since we are resampling some arbitrary
                // frequency to f_smp; this is an anti-aliasing filter and is
                // implemented as an IIR butterworth filter (usually we'd use an FIR
                // brick wall filter, but this is much simpler computationally and
                // sounds fine)
                y = f0 * (s + fs0) + f1 * fs1 + f2 * fs2;
                fs2 = fs1; fs1 = y; fs0 = s;
                dataL[i] += vL * y;
                dataR[i] += vR * y;
                Vrms += (vL + vR) * y * y;
                k += dk;
            }
        }
        ch.off = k;
        ch.filterstate[0] = fs0;
        ch.filterstate[1] = fs1;
        ch.filterstate[2] = fs2;
        ch.vL = vL;
        ch.vR = vR;
        return Vrms * 0.5;
    }

    audio_cb(e) {
        f_smp = this.audioctx.sampleRate;
        var time_sound_started;
        var buflen = e.outputBuffer.length;
        var dataL = e.outputBuffer.getChannelData(0);
        var dataR = e.outputBuffer.getChannelData(1);
        var i, j, k;

        for (i = 0; i < buflen; i++) {
            dataL[i] = 0;
            dataR[i] = 0;
        }

        var offset = 0;
        var ticklen = 0 | (f_smp * 2.5 / this.xm.bpm);
        var scopewidth = this.XMView.scope_width;

        while (buflen > 0) {
            if (this.cur_pat == -1 || this.cur_ticksamp >= ticklen) {
                this.nextTick(f_smp);
                this.cur_ticksamp -= ticklen;
            }
            var tickduration = Math.min(buflen, ticklen - this.cur_ticksamp);
            var VU = new Float32Array(this.xm.nchan);
            var scopes = undefined;
            for (j = 0; j < this.xm.nchan; j++) {
                var scope;
                if (tickduration >= 4 * scopewidth) {
                    scope = new Float32Array(scopewidth);
                    for (k = 0; k < scopewidth; k++) {
                        scope[k] = -dataL[offset + k * 4] - dataR[offset + k * 4];
                    }
                }

                VU[j] = this.MixChannelIntoBuf(
                    this.xm.channelinfo[j], offset, offset + tickduration, dataL, dataR) /
                    tickduration;

                if (tickduration >= 4 * scopewidth) {
                    for (k = 0; k < scopewidth; k++) {
                        scope[k] += dataL[offset + k * 4] + dataR[offset + k * 4];
                    }
                    if (scopes === undefined) scopes = [];
                    scopes.push(scope);
                }
            }
            const position = e.playbackTime + (0.0 + offset) / f_smp;
            if (this.XMView.pushEvent) {
                this.XMView.pushEvent({
                    t: position,
                    vu: VU,
                    scopes: scopes,
                    songpos: this.cur_songpos,
                    pat: this.cur_pat,
                    row: this.cur_row
                });
            }
            offset += tickduration;
            this.cur_ticksamp += tickduration;
            buflen -= tickduration;
        }
    }

    ConvertSample(array, bits) {
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

    // optimization: unroll short sample loops so we can run our inner mixing loop
    // uninterrupted for as long as possible; this also handles pingpong loops.
    UnrollSampleLoop(samp) {
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

    load(arrayBuf) {
        var dv = new DataView(arrayBuf);
        this.xm = {};

        this.xm.songname = this.getstring(dv, 17, 20);
        var hlen = dv.getUint32(0x3c, true) + 0x3c;
        var songlen = dv.getUint16(0x40, true);
        this.xm.song_looppos = dv.getUint16(0x42, true);
        this.xm.nchan = dv.getUint16(0x44, true);
        var npat = dv.getUint16(0x46, true);
        var ninst = dv.getUint16(0x48, true);
        this.xm.flags = dv.getUint16(0x4a, true);
        this.xm.tempo = dv.getUint16(0x4c, true);
        this.xm.bpm = dv.getUint16(0x4e, true);
        this.xm.channelinfo = [];
        this.xm.global_volume = this.max_global_volume;

        var i, j, k;

        for (i = 0; i < this.xm.nchan; i++) {
            this.xm.channelinfo.push({
                number: i,
                filterstate: new Float32Array(3),
                vol: 0,
                pan: 128,
                period: 1920 - 48 * 16,
                vL: 0, vR: 0,   // left right volume envelope followers (changes per sample)
                vLprev: 0, vRprev: 0,
                mute: 0,
                volE: 0, panE: 0,
                retrig: 0,
                vibratopos: 0,
                vibratodepth: 1,
                vibratospeed: 1,
                vibratotype: 0,
            });
        }
        console.debug("header len " + hlen);

        console.debug("songlen %d, %d channels, %d patterns, %d instruments", songlen, this.xm.nchan, npat, ninst);
        console.debug("loop @%d", this.xm.song_looppos);
        console.debug("flags=%d tempo %d bpm %d", this.xm.flags, this.xm.tempo, this.xm.bpm);

        this.xm.songpats = [];
        for (i = 0; i < songlen; i++) {
            this.xm.songpats.push(dv.getUint8(0x50 + i));
        }
        console.debug("song patterns: ", this.xm.songpats);

        var idx = hlen;
        this.xm.patterns = [];
        for (i = 0; i < npat; i++) {
            var pattern = [];
            var patheaderlen = dv.getUint32(idx, true);
            var patrows = dv.getUint16(idx + 5, true);
            var patsize = dv.getUint16(idx + 7, true);
            console.debug("pattern %d: %d bytes, %d rows", i, patsize, patrows);
            idx += 9;
            for (j = 0; patsize > 0 && j < patrows; j++) {
                let row = [];
                for (k = 0; k < this.xm.nchan; k++) {
                    var byte0 = dv.getUint8(idx); idx++;
                    var note = -1, inst = -1, vol = -1, efftype = 0, effparam = 0;
                    if (byte0 & 0x80) {
                        if (byte0 & 0x01) {
                            note = dv.getUint8(idx) - 1; idx++;
                        }
                        if (byte0 & 0x02) {
                            inst = dv.getUint8(idx); idx++;
                        }
                        if (byte0 & 0x04) {
                            vol = dv.getUint8(idx); idx++;
                        }
                        if (byte0 & 0x08) {
                            efftype = dv.getUint8(idx); idx++;
                        }
                        if (byte0 & 0x10) {
                            effparam = dv.getUint8(idx); idx++;
                        }
                    } else {
                        // byte0 is note from 1..96 or 0 for nothing or 97 for release
                        // so we subtract 1 so that C-0 is stored as 0
                        note = byte0 - 1;
                        inst = dv.getUint8(idx); idx++;
                        vol = dv.getUint8(idx); idx++;
                        efftype = dv.getUint8(idx); idx++;
                        effparam = dv.getUint8(idx); idx++;
                    }
                    var notedata = [note, inst, vol, efftype, effparam];
                    row.push(notedata);
                }
                pattern.push(row);
            }
            this.xm.patterns.push(pattern);
        }

        this.xm.instruments = [];
        // now load instruments
        for (i = 0; i < ninst; i++) {
            var hdrsiz = dv.getUint32(idx, true);
            var instname = this.getstring(dv, idx + 0x4, 22);
            var nsamp = dv.getUint16(idx + 0x1b, true);
            var inst = {
                'name': instname,
                'number': i,
            };
            if (nsamp > 0) {
                var samplemap = new Uint8Array(arrayBuf, idx + 33, 96);

                var env_nvol = dv.getUint8(idx + 225);
                var env_vol_type = dv.getUint8(idx + 233);
                var env_vol_sustain = dv.getUint8(idx + 227);
                var env_vol_loop_start = dv.getUint8(idx + 228);
                var env_vol_loop_end = dv.getUint8(idx + 229);
                var env_npan = dv.getUint8(idx + 226);
                var env_pan_type = dv.getUint8(idx + 234);
                var env_pan_sustain = dv.getUint8(idx + 230);
                var env_pan_loop_start = dv.getUint8(idx + 231);
                var env_pan_loop_end = dv.getUint8(idx + 232);
                var vol_fadeout = dv.getUint16(idx + 239, true);
                var env_vol = [];
                for (j = 0; j < env_nvol * 2; j++) {
                    env_vol.push(dv.getUint16(idx + 129 + j * 2, true));
                }
                var env_pan = [];
                for (j = 0; j < env_npan * 2; j++) {
                    env_pan.push(dv.getUint16(idx + 177 + j * 2, true));
                }
                // FIXME: ignoring keymaps for now and assuming 1 sample / instrument
                // var keymap = getarray(dv, idx+0x21);
                var samphdrsiz = dv.getUint32(idx + 0x1d, true);
                console.debug("hdrsiz %d; instrument %s: '%s' %d samples, samphdrsiz %d",
                    hdrsiz, (i + 1).toString(16), instname, nsamp, samphdrsiz);
                idx += hdrsiz;
                var totalsamples = 0;
                var samps = [];
                for (j = 0; j < nsamp; j++) {
                    var samplen = dv.getUint32(idx, true);
                    var samploop = dv.getUint32(idx + 4, true);
                    var samplooplen = dv.getUint32(idx + 8, true);
                    var sampvol = dv.getUint8(idx + 12);
                    var sampfinetune = dv.getInt8(idx + 13);
                    var samptype = dv.getUint8(idx + 14);
                    var samppan = dv.getUint8(idx + 15);
                    var sampnote = dv.getInt8(idx + 16);
                    var sampname = this.getstring(dv, idx + 18, 22);
                    var sampleoffset = totalsamples;
                    if (samplooplen === 0) {
                        samptype &= ~3;
                    }
                    console.debug("sample %d: len %d name '%s' loop %d/%d vol %d offset %s",
                        j, samplen, sampname, samploop, samplooplen, sampvol, sampleoffset.toString(16));
                    console.debug("           type %d note %s(%d) finetune %d pan %d",
                        samptype, this.prettify_note(sampnote + 12 * 4), sampnote, sampfinetune, samppan);
                    console.debug("           vol env", env_vol, env_vol_sustain,
                        env_vol_loop_start, env_vol_loop_end, "type", env_vol_type,
                        "fadeout", vol_fadeout);
                    console.debug("           pan env", env_pan, env_pan_sustain,
                        env_pan_loop_start, env_pan_loop_end, "type", env_pan_type);
                    var samp = {
                        'len': samplen, 'loop': samploop,
                        'looplen': samplooplen, 'note': sampnote, 'fine': sampfinetune,
                        'pan': samppan, 'type': samptype, 'vol': sampvol,
                        'fileoffset': sampleoffset
                    };
                    // length / pointers are all specified in bytes; fixup for 16-bit samples
                    samps.push(samp);
                    idx += samphdrsiz;
                    totalsamples += samplen;
                }
                for (j = 0; j < nsamp; j++) {
                    var samp = samps[j];
                    samp.sampledata = this.ConvertSample(
                        new Uint8Array(arrayBuf, idx + samp.fileoffset, samp.len), samp.type & 16);
                    if (samp.type & 16) {
                        samp.len /= 2;
                        samp.loop /= 2;
                        samp.looplen /= 2;
                    }
                    // unroll short loops and any pingpong loops
                    if ((samp.type & 3) && (samp.looplen < 2048 || (samp.type & 2))) {
                        this.UnrollSampleLoop(samp);
                    }
                }
                idx += totalsamples;
                inst.samplemap = samplemap;
                inst.samples = samps;
                if (env_vol_type) {
                    // insert an automatic fadeout to 0 at the end of the envelope
                    var env_end_tick = env_vol[env_vol.length - 2];
                    if (!(env_vol_type & 2)) {  // if there's no sustain point, create one
                        env_vol_sustain = env_vol.length / 2;
                    }
                    if (vol_fadeout > 0) {
                        var fadeout_ticks = 65536.0 / vol_fadeout;
                        env_vol.push(env_end_tick + fadeout_ticks);
                        env_vol.push(0);
                    }
                    inst.env_vol = new Envelope(
                        env_vol,
                        env_vol_type,
                        env_vol_sustain,
                        env_vol_loop_start,
                        env_vol_loop_end);
                } else {
                    // no envelope, then just make a default full-volume envelope.
                    // i thought this would use fadeout, but apparently it doesn't.
                    inst.env_vol = new Envelope([0, 64, 1, 0], 2, 0, 0, 0);
                }
                if (env_pan_type) {
                    if (!(env_pan_type & 2)) {  // if there's no sustain point, create one
                        env_pan_sustain = env_pan.length / 2;
                    }
                    inst.env_pan = new Envelope(
                        env_pan,
                        env_pan_type,
                        env_pan_sustain,
                        env_pan_loop_start,
                        env_pan_loop_end);
                } else {
                    // create a default empty envelope
                    inst.env_pan = new Envelope([0, 32], 0, 0, 0, 0);
                }
            } else {
                idx += hdrsiz;
                console.debug("empty instrument", i, hdrsiz, idx);
            }
            this.xm.instruments.push(inst);
        }

        console.debug("loaded \"" + this.xm.songname + "\"");
        return true;
    }

    async init(context) {
        if (!this.audioctx || (context && this.audioctx !== context)) {
            var audioContext = window.AudioContext || window.webkitAudioContext;
            this.audioctx = context || new audioContext();
        }

        if (!this.gainNode || this.gainNode.context !== this.audioctx) {
            this.gainNode = this.audioctx.createGain();
            this.gainNode.gain.value = 1;  // master volume
        }

        if (this.audioctx.createScriptProcessor === undefined) {
            this.jsNode = this.audioctx.createJavaScriptNode(16384, 0, 2);
        } else {

            this.jsNode = this.audioctx.createScriptProcessor(16384, 0, 2);

            // await this.audioctx.audioWorklet.addModule('/js/test-processor.js')
            // this.jsNode = new AudioWorkletNode(this.audioctx, 'test-processor')
            // this.jsNode.connect(this.audioctx.destination)

        }
        this.jsNode.onaudioprocess = (e) => {
            return this.audio_cb(e);
        };
        this.gainNode.connect(this.audioctx.destination);
    }

    play() {
        if (!this.playing) {
            // put paused events back into action, if any
            if (this.XMView.resume) {
                this.XMView.resume();
            }
            // start playing
            this.jsNode.connect(this.gainNode);

            // hack to get iOS to play anything
            var temp_osc = this.audioctx.createOscillator();
            temp_osc.connect(this.audioctx.destination);
            !!temp_osc.start ? temp_osc.start(0) : temp_osc.noteOn(0);
            !!temp_osc.stop ? temp_osc.stop(0) : temp_osc.noteOff(0);
            temp_osc.disconnect();
        }
        this.playing = true;
    }

    pause() {
        if (this.playing) {
            this.jsNode.disconnect(this.gainNode);
            if (this.XMView.pause) {
                this.XMView.pause();
            }
        }
        this.playing = false;
    }

    stop() {
        if (this.playing) {
            this.jsNode.disconnect(this.gainNode);
            this.playing = false;
        }
        this.cur_pat = -1;
        this.cur_row = 64;
        this.cur_songpos = -1;
        this.cur_ticksamp = 0;
        this.xm.global_volume = this.max_global_volume;
        if (this.XMView.stop) {
            this.XMView.stop();
        }
        this.init();
    }

}