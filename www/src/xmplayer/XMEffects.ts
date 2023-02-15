export class XMEffects {
    [key: string]: any;

    constructor(player) {

        this.effects_t0 = [
            this.eff_t1_0,
            this.eff_t0_1,
            this.eff_t0_2,
            this.eff_t0_3,
            this.eff_t0_4,
            this.eff_t0_a,
            this.eff_t0_a,
            this.eff_unimplemented_t0,
            this.eff_t0_8,
            this.eff_t0_9,
            this.eff_t0_a,
            this.eff_t0_b,
            this.eff_t0_c,
            this.eff_t0_d,
            this.eff_t0_e,
            this.eff_t0_f,
            this.eff_t0_g,
            this.eff_t0_h,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_t0_r,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0,
            this.eff_unimplemented_t0, // z
        ];

        this.effects_t1 = [
            this.eff_t1_0,
            this.eff_t1_1,
            this.eff_t1_2,
            this.eff_t1_3,
            this.eff_t1_4,
            this.eff_t1_5,
            this.eff_t1_6,
            this.eff_unimplemented,
            null,
            null,
            this.eff_t1_a,
            null,
            null,
            null,
            this.eff_t1_e,
            null,
            null,
            this.eff_t1_h,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_t1_r,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented,
            this.eff_unimplemented // z
        ];

        this.effects_t0 = this.effects_t0.map((e) => e ? e.bind(this) : e);

        this.effects_t1 = this.effects_t1.map((e) => e ? e.bind(this) : e);

        this.player = player;
    }

    eff_t1_0(ch) {
        if (ch.effectdata !== 0 && ch.inst !== undefined) {
            var arpeggio = [0, ch.effectdata >> 4, ch.effectdata & 15];
            var note = ch.note + arpeggio[this.player.cur_tick % 3];
            ch.period = this.player.periodForNote(ch, note);
        }
    }

    eff_t0_1(ch, data) {
        if (data !== 0) {
            ch.slideupspeed = data;
        }
    }

    eff_t1_1(ch) {
        if (ch.slideupspeed !== undefined) {
            // is this limited? it appears not
            ch.period -= ch.slideupspeed;
        }
    }

    eff_t0_2(ch, data) {
        if (data !== 0) {
            ch.slidedownspeed = data;
        }
    }

    eff_t1_2(ch) {
        if (ch.slidedownspeed !== undefined) {
            // 1728 is the period for C-1
            ch.period = Math.min(1728, ch.period + ch.slidedownspeed);
        }
    }

    eff_t0_3(ch, data) {
        if (data !== 0) {
            ch.portaspeed = data;
        }
    }

    eff_t1_3(ch) {
        if (ch.periodtarget !== undefined && ch.portaspeed !== undefined) {
            if (ch.period > ch.periodtarget) {
                ch.period = Math.max(ch.periodtarget, ch.period - ch.portaspeed);
            } else {
                ch.period = Math.min(ch.periodtarget, ch.period + ch.portaspeed);
            }
        }
    }

    eff_t0_4(ch, data) {
        if (data & 0x0f) {
            ch.vibratodepth = (data & 0x0f) * 2;
        }
        if (data >> 4) {
            ch.vibratospeed = data >> 4;
        }
        this.eff_t1_4(ch);
    }

    eff_t1_4(ch) {
        ch.periodoffset = this.getVibratoDelta(ch.vibratotype, ch.vibratopos) * ch.vibratodepth;
        if (isNaN(ch.periodoffset)) {
            console.log("vibrato periodoffset NaN?",
                ch.vibratopos, ch.vibratospeed, ch.vibratodepth);
            ch.periodoffset = 0;
        }
        // only updates on non-first ticks
        if (this.player.cur_tick > 0) {
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

    eff_t1_5(ch) {
        this.eff_t1_a(ch);
        this.eff_t1_3(ch);
    }

    eff_t1_6(ch) {
        this.eff_t1_a(ch);
        this.eff_t1_4(ch);
    }

    eff_t0_8(ch, data) {
        ch.pan = data;
    }

    eff_t0_9(ch, data) {
        ch.off = data * 256;
    }

    eff_t0_a(ch, data) {
        if (data) {
            ch.volumeslide = -(data & 0x0f) + (data >> 4);
        }
    }

    eff_t1_a(ch) {
        if (ch.volumeslide !== undefined) {
            ch.vol = Math.max(0, Math.min(64, ch.vol + ch.volumeslide));
        }
    }

    eff_t0_b(ch, data) {
        const p = this.player;
        if (data < p.xm.songpats.length) {
            p.cur_songpos = data - 1; // data;
            p.cur_pat = -1; // p.xm.songpats[p.cur_songpos];
            p.cur_row = -1;
        }
    }

    eff_t0_c(ch, data) {
        ch.vol = Math.min(64, data);
    }

    eff_t0_d(ch, data) {
        const p = this.player;
        p.cur_songpos++;
        if (p.cur_songpos >= p.xm.songpats.length)
            p.cur_songpos = p.xm.song_looppos;
        p.cur_pat = p.xm.songpats[p.cur_songpos];
        p.cur_row = (data >> 4) * 10 + (data & 0x0f); // -1
    }

    eff_t0_e(ch, data) {
        const player = this.player;
        const eff = data >> 4;

        data = data & 0x0f;

        switch (eff) {
            case 1: // fine porta up
                ch.period -= data;
                break;
            case 2: // fine porta down
                ch.period += data;
                break;
            case 4: // set vibrato waveform
                ch.vibratotype = data & 0x07;
                break;
            case 5: // finetune
                ch.fine = (data << 4) + data - 128;
                break;
            case 6:  // pattern loop
                if (data == 0) {
                  ch.loopstart = player.cur_row
                } else {
                  if (typeof ch.loopend === "undefined") {
                    ch.loopend = player.cur_row;
                    ch.loopremaining = data;
                  }
                  if(ch.loopremaining !== 0) {
                    ch.loopremaining--;
                    player.next_row = ch.loopstart || 0;
                  } else {
                    delete ch.loopend;
                    delete ch.loopstart;
                  }
                }
                break;
            case 8: // panning
                ch.pan = data * 0x11;
                break;
            case 0x0a: // fine vol slide up (with memory)
                if (data === 0 && ch.finevolup !== undefined)
                    data = ch.finevolup;
                ch.vol = Math.min(64, ch.vol + data);
                ch.finevolup = data;
                break;
            case 0x0b: // fine vol slide down
                if (data === 0 && ch.finevoldown !== undefined)
                    data = ch.finevoldown;
                ch.vol = Math.max(0, ch.vol - data);
                ch.finevoldown = data;
                break;
            case 0x0c: // note cut handled in eff_t1_e
                break;
            default:
                console.debug("unimplemented extended effect E", ch.effectdata.toString(16));
                break;
        }
    }

    eff_t1_e(ch) {
        switch (ch.effectdata >> 4) {
            case 0x0c:
                if (this.player.cur_tick == (ch.effectdata & 0x0f)) {
                    ch.vol = 0;
                }
                break;
        }
    }

    eff_t0_f(ch, data) {
        if (data === 0) {
            console.log("tempo 0?");
            return;
        } else if (data < 0x20) {
            // console.log(this);
            this.player.xm.tempo = data;
        } else {
            this.player.xm.bpm = data;
        }
    }

    eff_t0_g(ch, data) {
        if (data <= 0x40) {
            // volume gets multiplied by 2 to match
            // the initial max global volume of 128
            this.player.xm.global_volume = Math.max(0, data * 2);
        } else {
            this.player.xm.global_volume = this.player.max_global_volume;
        }
    }

    eff_t0_h(ch, data) {
        if (data) {
            // same as Axy but multiplied by 2
            this.player.xm.global_volumeslide = (-(data & 0x0f) + (data >> 4)) * 2;
        }
    }

    eff_t1_h(ch) {
        if (this.player.xm.global_volumeslide !== undefined) {
            this.player.xm.global_volume = Math.max(0, Math.min(this.player.max_global_volume,
                this.player.xm.global_volume + this.player.xm.global_volumeslide));
        }
    }

    eff_t0_r(ch, data) {
        if (data & 0x0f)
            ch.retrig = (ch.retrig & 0xf0) + (data & 0x0f);
        if (data & 0xf0)
            ch.retrig = (ch.retrig & 0x0f) + (data & 0xf0);

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
        if (this.player.cur_tick % (ch.retrig & 0x0f) === 0) {
            ch.off = 0;
        }
    }

    eff_unimplemented() { }

    eff_unimplemented_t0(ch, data) {
        console.log("unimplemented effect", this.prettify_effect(ch.effect, data));
    }
}
export class Envelope {
    [key: string]: any;

    constructor(points, type, sustain, loopstart, loopend) {
        this.points = points;
        this.type = type;
        this.sustain = sustain;
        this.loopstart = points[loopstart * 2];
        this.loopend = points[loopend * 2];

        this.__serializeCtor = 'Envelope';
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
export class EnvelopeFollower {
    [key: string]: any;

    constructor(env) {
        this.env = env;
        this.tick = 0;

        this.__serializeCtor = 'EnvelopeFollower';
    }

    Tick(release) {
        var value = this.env.Get(this.tick);

        // if we're sustaining a note, stop advancing the tick counter
        if (!release && this.tick >= this.env.points[this.env.sustain * 2]) {
            return this.env.points[this.env.sustain * 2 + 1];
        }

        this.tick++;
        if (this.env.type & 4) { // envelope loop?
            if (!release &&
                this.tick >= this.env.loopend) {
                this.tick -= this.env.loopend - this.env.loopstart;
            }
        }
        return value;
    }
}
