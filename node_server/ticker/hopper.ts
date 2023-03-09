import {ServerClient} from "@client/server_client.js";
import type { TickingBlockManager } from "../server_chunk.js";

export default class Ticker {

    static type = 'hopper'

    //
    static func(this: TickingBlockManager, tick_number, world, chunk, v) {

        const bm = world.block_manager;

    }

}