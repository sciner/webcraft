let soundMap = null

const worker = {
    init: function () {
        if (typeof process !== 'undefined') {
            import('worker_threads').then(module => {
                this.parentPort = module.parentPort;
                this.parentPort.on('message', onMessageFunc);
            });
        } else {
            onmessage = onMessageFunc
        }
    },

    postMessage: function (message) {
        if (this.parentPort) {
            this.parentPort.postMessage(message);
        } else {
            postMessage(message);
        }
    }
}

worker.init()

async function preLoad() {
    const module = await import('./volumetric_sound.js')
    soundMap = new module.SoundMap()
    soundMap.sendQueryFn = (query) => {
        worker.postMessage(['query_chunks', query])
    }
    soundMap.sendResultFn = (result) => {
        worker.postMessage(['result', result])
    }
}

preLoad()

async function onMessageFunc(msg) {
    if (!soundMap) {
        return // still loading, skip this message
    }
    msg = msg.data ?? msg
    const cmd = msg[0]
    switch(cmd) {
        case 'player_pos':
            soundMap.onPlayerPos(msg[1])
            break
        case 'flowing_diff':
            soundMap.onFlowingDiff(msg[1])
            break
    }
}

if (typeof process !== 'undefined') {
    import('worker_threads').then(module => module.parentPort.on('message', onMessageFunc))
} else {
    onmessage = onMessageFunc
}