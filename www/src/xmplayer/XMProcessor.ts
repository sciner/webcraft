// @ts-check
import { ConvertSample, GetString, UnrollSampleLoop } from './Utils.js';
import { XMEffects, EnvelopeFollower, Envelope } from "./XMEffects.js";

console.debug = () => undefined;
console.log = () => undefined;

/**
 * @type { AudioWorkletGlobalScope }
 *
 */
const context = globalThis;

// per-sample exponential moving average for volume changes (to prevent pops
// and clicks); evaluated every 8 samples
const popfilter_alpha = 0.9837;

class XMProcessor extends AudioWorkletProcessor {
    [key: string]: any;
    static processorKey = 'xm-processor';

    constructor() {
        super();
        this.playing = false;
        this.xm = {};
        this.cur_songpos        = -1;
        this.cur_pat            = -1;
        this.cur_row            = 64;
        this.cur_ticksamp       = 0;
        this.cur_tick           = 6;
        this.xm                 = {};  // contains all song data
        this.max_global_volume  = 128;
        this.xm.global_volume   = this.max_global_volume;

        this.messageId = 1 << 8;
        this.onMessage = this.onMessage.bind(this);
        this.tasks = {};

        this.effects = new XMEffects(this);

        this.port.addEventListener('message', this.onMessage);
        this.port.start();
    }

    notify (type, data, transferable, id = null) {
        return new Promise((res) => {
            const messageId = id == null ? this.messageId : id;

            this.tasks[messageId] = res;

            this.port.postMessage({
                type,
                data,
                messageId,
            }, transferable ? transferable : undefined);

            this.messageId ++;
        });
    }

    onMessage({ data: msgData }) {
        const { messageId, data, type } = msgData;

        if (messageId in this.tasks) {
            this.tasks[messageId](data, messageId);
            delete this.tasks[messageId];
            return;
        }

        // invoke api methods that exist
        if (typeof this['api_' + type] === 'function') {
            const result = this['api_' + type](data);

            if (result !== undefined) {
                this.notify(type, result, null,  messageId);
            }
        } else {
            console.warn('[Worklet] Not known method', type);
        }
    }

    api_reset() {
        this.playing = false;
        this.cur_songpos        = -1;
        this.cur_pat            = -1;
        this.cur_row            = 64;
        this.cur_ticksamp       = 0;
        this.cur_tick           = 6;
        // this.xm                 = {};  // contains all song data
        this.max_global_volume  = 128;
        this.xm.global_volume   = this.max_global_volume;

        this.effects = new XMEffects(this);
    }

    async _init(data) {
        this.api_reset();
        return true;
    }

    api_play() {
        return this.playing = true;
    }

    api_pause() {
        return this.playing = false;
    }

    api_load({ buffer }) {
        this.api_reset();
        var dv = new DataView(buffer);
        this.xm = {};

        this.xm.songname = GetString(dv, 17, 20);
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


        // TODO
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
            var instname = GetString(dv, idx + 0x4, 22);
            var nsamp = dv.getUint16(idx + 0x1b, true);

            /**
             * @type { Instrument }
             */
            const inst = {
                name: instname,
                number: i,
                samplemap: null,
                samples: null,
            };

            if (nsamp > 0) {
                var samplemap = new Uint8Array(buffer, idx + 33, 96);

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
                    var sampname = GetString(dv, idx + 18, 22);
                    var sampleoffset = totalsamples;
                    if (samplooplen === 0) {
                        samptype &= ~3;
                    }

                    /*
                    console.debug("sample %d: len %d name '%s' loop %d/%d vol %d offset %s",
                        j, samplen, sampname, samploop, samplooplen, sampvol, sampleoffset.toString(16));
                    console.debug("           type %d note %s(%d) finetune %d pan %d",
                        samptype, this.prettify_note(sampnote + 12 * 4), sampnote, sampfinetune, samppan);
                    console.debug("           vol env", env_vol, env_vol_sustain,
                        env_vol_loop_start, env_vol_loop_end, "type", env_vol_type,
                        "fadeout", vol_fadeout);
                    console.debug("           pan env", env_pan, env_pan_sustain,
                        env_pan_loop_start, env_pan_loop_end, "type", env_pan_type);

                    */
                    // length / pointers are all specified in bytes; fixup for 16-bit samples
                    samps.push({
                        len: samplen,
                        loop: samploop,
                        looplen: samplooplen,
                        note: sampnote,
                        fine: sampfinetune,
                        pan: samppan,
                        type: samptype,
                        vol: sampvol,
                        fileoffset: sampleoffset,
                        sampledata: null,
                    });

                    idx += samphdrsiz;
                    totalsamples += samplen;
                }
                for (j = 0; j < nsamp; j++) {
                    var samp = samps[j];
                    samp.sampledata = ConvertSample(
                        new Uint8Array(buffer, idx + samp.fileoffset, samp.len), samp.type & 16);
                    if (samp.type & 16) {
                        samp.len /= 2;
                        samp.loop /= 2;
                        samp.looplen /= 2;
                    }
                    // unroll short loops and any pingpong loops
                    if ((samp.type & 3) && (samp.looplen < 2048 || (samp.type & 2))) {
                        UnrollSampleLoop(samp);
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

        return this.xm;
    }


    process(input, output, params) {
        const dataL = output[0][0];
        // chanell can be empty
        const dataR = output[0][1] || new Float32Array(dataL.length);

        return this.tick ( { dataL, dataR });
    }

    tick( { dataL, dataR } ) {
        const f_smp = context.sampleRate;
        const ticklen = 0 | (f_smp * 2.5 / this.xm.bpm);

        let buflen = dataL.length;

        /*
        for (let i = 0; i < buflen; i++) {
            dataL[i] = 0;
            dataR[i] = 0;
        }
        */

        let offset = 0;

        // var scopewidth = this.XMView.scope_width;

        while (buflen > 0 && this.playing) {
            if (this.cur_pat == -1 || this.cur_ticksamp >= ticklen) {
                this.nextTick(f_smp);
                this.cur_ticksamp -= ticklen;
            }
            var tickduration = Math.min(buflen, ticklen - this.cur_ticksamp);
            // var VU = new Float32Array(this.xm.nchan);
            // var scopes = undefined;
            for (let j = 0; j < this.xm.nchan; j++) {
                /*
                var scope;
                if (tickduration >= 4 * scopewidth) {
                    scope = new Float32Array(scopewidth);
                    for (k = 0; k < scopewidth; k++) {
                        scope[k] = -dataL[offset + k * 4] - dataR[offset + k * 4];
                    }
                }*/

                // VU[j] =
                this.MixChannelIntoBuf(
                    this.xm.channelinfo[j], offset, offset + tickduration, dataL, dataR) /
                    tickduration;

                /*
                if (tickduration >= 4 * scopewidth) {
                    for (k = 0; k < scopewidth; k++) {
                        scope[k] += dataL[offset + k * 4] + dataR[offset + k * 4];
                    }
                    if (scopes === undefined) scopes = [];
                    scopes.push(scope);
                }
                */
            }

            const position = context.currentTime + (0.0 + offset) / f_smp;

            /*
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
            */

            offset += tickduration;
            this.cur_ticksamp += tickduration;
            buflen -= tickduration;
        }

        return true;
    }

    nextTick(fspmp) {
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
            /*
            if (isNaN(ch.period)) {
                console.debug(this.prettify_notedata(
                    this.xm.patterns[this.cur_pat][this.cur_row][j]),
                    "set channel", j, "period to NaN");
            }
            */
            if (inst === undefined) continue;
            /*
            if (ch.env_vol === undefined) {
                console.debug(this.prettify_notedata(
                    this.xm.patterns[this.cur_pat][this.cur_row][j]),
                    "set channel", j, "env_vol to undefined, but note is playing");
                continue;
            }
            */
            ch.volE = ch.env_vol.Tick(ch.release);
            ch.panE = ch.env_pan.Tick(ch.release);
            this.updateChannelPeriod(ch, ch.period + ch.periodoffset);
        }
    }

    nextRow() {
        if (typeof this.next_row === "undefined") {
            this.next_row = this.cur_row + 1;
        }

        this.cur_row = this.next_row;
        this.next_row++;

        if (this.cur_pat == -1 || this.cur_row >= this.xm.patterns[this.cur_pat].length) {
            this.cur_row = 0;
            this.next_row = 1;
            this.cur_songpos++;
            if (this.cur_songpos >= this.xm.songpats.length) {
                this.cur_songpos = this.xm.song_looppos;
            }
            this.setCurrentPattern();
        }
        let p = this.xm.patterns[this.cur_pat];
        let r = p[this.cur_row];
        for (let i = 0; i < r.length; i++) {
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
                    ch.voleffectfn = (e) => this.effects.effects_t1[4](ch);  // use vibrato effect directly
                    this.effects.effects_t1[4](ch);  // and also call it on tick 0
                } else if (v >= 0xc0 && v < 0xd0) {  // set panning
                    ch.pan = (v & 0x0f) * 0x11;
                } else if (v >= 0xf0 && v <= 0xff) {  // portamento
                    if (v & 0x0f) {
                        ch.portaspeed = (v & 0x0f) << 4;
                    }
                    ch.voleffectfn = (e) => this.effects.effects_t1[3](ch);  // just run 3x0
                } else {
                    console.debug("channel", i, "volume effect", v.toString(16));
                }
            }

            ch.effect = r[i][3];
            ch.effectdata = r[i][4];
            if (ch.effect < 36) {
                ch.effectfn = (e) => {
                    if (this.effects.effects_t1[ch.effect]) {
                        this.effects.effects_t1[ch.effect](ch);
                    }
                };
                /*
                var eff_t0 = (e) => { this.effects.effects_t0[ch.effect]};
                if (eff_t0 && eff_t0(ch, ch.effectdata)) {
                    triggernote = false;
                }
                */
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
            return 0;
        if (isNaN(volR) || isNaN(volL)) {
            console.debug("NaN volume!?", ch.number, volL, volR, volE, panE, ch.vol);
            return 0;
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
                // console.debug("failsafe in mixing loop! channel", ch.number, k, sample_end,
                //    loopstart, looplen, dk);
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

    // This function gradually brings the channel back down to zero if it isn't
    // already to avoid clicks and pops when samples end.
    MixSilenceIntoBuf(ch, start, end, dataL, dataR) {
        var s = ch.filterstate[1];
        if (isNaN(s)) {
            console.debug("NaN filterstate?", ch.filterstate, ch.filter);
            return 0;
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
            return 0;
        }
        return 0;
    }
    updateChannelPeriod(ch, period) {
        var freq = 8363 * Math.pow(2, (1152.0 - period) / 192.0);
        if (isNaN(freq)) {
            console.debug("invalid period!", period);
            return;
        }
        ch.doff = freq / context.sampleRate;
        ch.filter = this.filterCoeffs(ch.doff / 2);
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

}

context.registerProcessor(XMProcessor.processorKey, XMProcessor);
