// We can't import types because of the TS bug https://github.com/microsoft/TypeScript/issues/44040
// import type { WorkerWorldManager } from './worker/world.js'

let missed_messages = []

async function onMissedMessage(msg : any) {
    missed_messages.push(msg)
}

if (typeof process == 'undefined') {
    onmessage = onMissedMessage
}

import('./worker/worker.js').then(module => {
    (globalThis as any).QubatchChunkWorker = new module.ChunkWorkerRoot()
    QubatchChunkWorker.init(missed_messages)
    QubatchChunkWorker.preLoad().then()
})