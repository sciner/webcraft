import { AbstractPlayerManager } from '../www/js/abstract_player_manager.js';

export class ServerPlayerManager extends AbstractPlayerManager {
    constructor(world) {
        super(world);
        this.deletedPlyersByUserId = new Map(); // holds deleted players until they can save their state
        this.deletedPlyersByUserIdBeingWritten = null; // to avoid errors in race conditions
    }

    delete(user_id) {
        const player = this.list.get(user_id);
        if (player) {
            player.savingPromise = this.world.dbActor.worldSavingPromise;
            this.deletedPlyersByUserId.set(user_id, player);
        }
        return super.delete(user_id);
    }

    getDeleted(user_id) {
        return (
            this.deletedPlyersByUserId.get(user_id) ??
            this.deletedPlyersByUserIdBeingWritten?.get(user_id)
        );
    }

    writeToWorldTransaction(underConstruction) {
        for (const player of this.list.values()) {
            player.writeToWorldTransaction(underConstruction);
        }
        for (const player of this.deletedPlyersByUserId.values()) {
            player.writeToWorldTransaction(underConstruction);
        }
        this.deletedPlyersByUserIdBeingWritten = this.deletedPlyersByUserId;
        this.deletedPlyersByUserId = new Map();
    }

    onWorldTransactionCommit() {
        this.deletedPlyersByUserIdBeingWritten = null;
    }
}
