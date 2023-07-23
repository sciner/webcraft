import type { ServerPlayer } from "server_player";
import type { ServerWorld } from "server_world";

export class WorldAdminManager {
    world: ServerWorld
    list: any;

    constructor(world: ServerWorld) {
        this.world = world
    }

    // Load
    async load() : Promise<string[]> {
        this.list = await this.world.db.loadAdminList(this.world.info.id)
        this.updated(this.list)
        return this.list
    }

    private updated(list: string[]) {
        this.world.worker_world.adminListUpdated(list)
    }

    // Return list
    getList() {
        return this.list
    }

    // Find
    isUsernameExist(username: string) : int {
        return this.list.indexOf(username)
    }

    // Return true if player is admin
    isAdmin(player : ServerPlayer) : boolean {
        // check if player system admin
        if (player.session.user_id == this.world.info.user_id) {
            return true
        }
        return this.isUsernameExist(player.session.username) >= 0
    }

    // Add
    async add(player: ServerPlayer, username: string) : Promise<string[] | null> {
        if(!player.isWorldAdmin()) {
            return null
        }
        const user = await this.world.db.findPlayer(this.world.info.id, username);
        if (!user) {
            throw 'error_user_not_found'
        }
        await this.world.db.setAdmin(this.world.info.id, user.id, 1);
        this.updateWorldAdminForPlayer(user.id, true)
        return await this.load()
    }

    // Remove
    async remove(player: ServerPlayer, username: string) : Promise<string[]> {
        if(!player.isWorldAdmin()) {
            throw 'error_not_permitted'
        }
        const user = await this.world.db.findPlayer(this.world.info.id, username);
        if (!user) {
            throw 'User not found';
        }
        if (user.id == this.world.info.user_id) {
            throw 'Can\'t remove owner';
        }
        await this.world.db.setAdmin(this.world.info.id, user.id, 0);
        this.updateWorldAdminForPlayer(user.id, false)
        return await this.load()
    }

    updateWorldAdminForPlayer(user_id: int, value: boolean) : void {
        for(const player of this.world.players.values()) {
            if(player.session.user_id == user_id) {
                player.state.world.is_admin = value
                player.sendState()
                break
            }
        }
    }

}