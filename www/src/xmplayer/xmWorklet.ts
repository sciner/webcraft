// @ts-check
export class XMPlayer {
    [key: string]: any;
    constructor() {
        this.audioctx = null;
        this.gainNode = null;
        this.worker = null;
        this.buffer = null;
        this.xm = {};

        this.active = false;

        /**
         * @type { MessagePort }
         */
        this.port = null;
        this.messageId = 0;
        this.tasks = {};

        this.onMessage = this.onMessage.bind(this);

        this._destination = null;
        this._volume = 1;
    }

    set volume(v) {
        this._volume = v;
        if (this.gainNode) {
            this.gainNode.gain.value = v;
        }
    }

    get volume() {
        return this._volume;
    }

    notify (type, data, transferable, id = null) {
        return new Promise((res) => {
            const messageId = id || this.messageId;

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
        const { messageId, data } = msgData;

        if (messageId in this.tasks) {
            this.tasks[messageId](data);
            delete this.tasks[messageId];
        }
    }

    async init(context = null, destination) {
        if (!this.audioctx || (context && this.audioctx !== context)) {
            var audioContext = window.AudioContext || window.webkitAudioContext;
            this.audioctx = context || new audioContext();
        }

        if (!this.gainNode || this.gainNode.context !== this.audioctx) {
            this.gainNode = this.audioctx.createGain();
            this.gainNode.gain.value = this._volume;  // master volume
        }

        if (!this.worker) {
            const url = new URL('/js/xmplayer/XMProcessor.js', location.origin);
            await this.audioctx.audioWorklet.addModule(url);

            this.worker = new AudioWorkletNode(this.audioctx, 'xm-processor');

            // we should re-bound events each worklet instance

            if (this.port) {
                this.port.removeEventListener('message', this.onMessage);
            }

            this.port = this.worker.port;
            this.port.addEventListener('message', this.onMessage);
            this.port.start();
            this.active = true;
        }

        destination = this._destination || destination || this.audioctx.destination;

        if (this._destination) {
            this.gainNode.connect(this._destination);
        }

        this._destination = destination;
        this.gainNode.connect(destination);
    

        if (this.buffer) {
            await this.load(this.buffer);
        }
    }

    async load(buffer) {
        if (!this.active) {
            await this.init();
        }

        this.buffer = null;

        const data = await this.notify('load', { buffer }, [buffer]);

        this.xm = data;

        return true;
    }

    async play() {
        if (!this.playing) {
            // start playing
            this.worker.connect(this.gainNode);

            /*
            // hack to get iOS to play anything
            var temp_osc = this.audioctx.createOscillator();
            temp_osc.connect(this.audioctx.destination);
            !!temp_osc.start ? temp_osc.start(0) : temp_osc.noteOn(0);
            !!temp_osc.stop ? temp_osc.stop(0) : temp_osc.noteOff(0);
            temp_osc.disconnect();
            */
        }

        this.playing = await this.notify('play');
    }

    async pause() {
        if (this.playing) {
            this.worker.disconnect(this.gainNode);
        }

        this.playing = await this.notify('pause');
    }

   async stop() {
        if (this.playing) {
            await this.pause();
        }

        this.init();
    }
}