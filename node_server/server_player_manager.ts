import { AbstractPlayerManager } from "@client/abstract_player_manager.js";
import type { WorldTransactionUnderConstruction } from "./db/world/WorldDBActor.js";
import type { ServerPlayer } from "./server_player.js";
import type { ServerWorld } from "./server_world.js";

export class ServerPlayerManager extends AbstractPlayerManager<ServerWorld, ServerPlayer> {

    deletedPlyersByUserId: Map<int, ServerPlayer>
    deletedPlyersByUserIdBeingWritten: Map<int, ServerPlayer>

    constructor(world: ServerWorld) {
        super(world)
        this.deletedPlyersByUserId = new Map(); // holds deleted players until they can save their state
        this.deletedPlyersByUserIdBeingWritten = null; // to avoid errors in race conditions
    }

    delete(user_id: number): boolean {
        const player = this.list.get(user_id);
        if (player) {
            player.savingPromise = this.world.dbActor.worldSavingPromise;
            this.deletedPlyersByUserId.set(user_id, player);
        }
        return super.delete(user_id);
    }

    getDeleted(user_id: number): ServerPlayer {
        return this.deletedPlyersByUserId.get(user_id)
            ?? this.deletedPlyersByUserIdBeingWritten?.get(user_id);
    }

    writeToWorldTransaction(underConstruction: WorldTransactionUnderConstruction) {
        for(const player of this.list.values()) {
            player.writeToWorldTransaction(underConstruction);
        }
        for(const player of this.deletedPlyersByUserId.values()) {
            player.writeToWorldTransaction(underConstruction);
        }
        this.deletedPlyersByUserIdBeingWritten = this.deletedPlyersByUserId;
        this.deletedPlyersByUserId = new Map();
    }

    onWorldTransactionCommit() {
        this.deletedPlyersByUserIdBeingWritten = null;
    }
}
