let soundMap = null
let playerPos = null
let playerPosTimeout = null

const msg_queue = [] // Message queue

const worker = {
    init: function () {
        if (typeof process !== 'undefined') {
            import('worker_threads').then(module => {
                this.parentPort = module.parentPort
                this.parentPort.on('message', onMessageFunc)
            })
        } else {
            onmessage = onMessageFunc
        }
    },

    postMessage: function (message) {
        if (this.parentPort) {
            this.parentPort.postMessage(message)
        } else {
            postMessage(message)
        }
    }
}

worker.init()

async function preLoad() {
    const module = await import('./volumetric_sound.js')
    soundMap = new module.SoundMap(worker)
}

preLoad()

async function onMessageFunc(msg : any) {

    if (!soundMap) {
        // still loading, queue it up and skip it
        msg_queue.push(msg)
        return
    }

    while(msg_queue.length > 0) {
        processMessage(msg_queue.shift())
    }

    processMessage(msg)

}

async function processMessage(msg : any) {

    msg = msg.data ?? msg
    const cmd = msg[0]
    const args = msg[1]

    switch(cmd) {
        case 'init': {
            soundMap.init(args)
            break
        }
        case 'player_pos': {
            playerPos = args
            // Skip multiple 'player_pos' messages if there is a queue. We only need the last one.
            if (!playerPosTimeout) {
                playerPosTimeout = setTimeout(() => {
                    playerPosTimeout = null
                    soundMap.onPlayerPos(playerPos)
                }, 1)
            }
            break
        }
        case 'flowing_diff': {
            soundMap.onFlowingDiff(args)
            break
        }
        default: {
            throw 'error_unrecognized_soundworker_message'
        }
    }

}