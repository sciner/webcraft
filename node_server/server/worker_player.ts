import type { ServerWorkerWorld } from "./worker_world.js"

export class ServerWorkerPlayer {
    worker_world: ServerWorkerWorld
    conn: any
    session: PlayerSession

    constructor(worker_world: ServerWorkerWorld, conn, session: PlayerSession) {

        this.worker_world = worker_world
        this.session = session
        this.conn = conn

        // Catch messages from websocket connection
        conn.player = this
        conn.on('message', this.onMessage.bind(this))

        // When close connection
        conn.on('close', async (e) => {
            this.worker_world.onLeave(this)
        })

    }

    // When message received from player by websocket
    async onMessage(cmd : any) {
        cmd = JSON.parse(cmd)
        this.worker_world.onPlayerCommand(this, cmd)
    }

}