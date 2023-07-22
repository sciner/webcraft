import type { ServerWorkerWorld } from "./worker_world.js"

export class ServerWorkerPlayer {
    world_item: ServerWorkerWorld
    conn: any
    session: PlayerSession

    constructor(world_item: ServerWorkerWorld, conn, session: PlayerSession) {

        this.world_item = world_item
        this.session = session
        this.conn = conn

        // Catch messages from websocket connection
        conn.player = this
        conn.on('message', this.onMessage.bind(this))

        // When close connection
        conn.on('close', async (e) => {
            this.world_item.onLeave(this)
        })

    }

    // When message received from player by websocket
    async onMessage(cmd : any) {
        cmd = JSON.parse(cmd)
        this.world_item.onPlayerCommand(this, cmd)
    }

}