import type { ServerWorld } from "server_world";

export class WorldAdminManager {
    world: ServerWorld;
    list: any;

    constructor(world) {
        this.world = world;
    }

    // Load
    async load() {
        return this.list = await this.world.db.loadAdminList(this.world.info.id);
    }

    // Return list
    getList() {
        return this.list;
    }

    // Find
    isUsernameExist(username) {
        return this.list.indexOf(username);
    }

    // Check player is admin
    checkIsAdmin(player) {
        if (player.session.user_id == this.world.info.user_id) {
            return true;
        }
        const i = this.isUsernameExist(player.session.username);
        return i >= 0;
    }

    // Add
    async add(player, username) {
        if(!this.checkIsAdmin(player)) {
            return null;
        }
        const user = await this.world.db.findPlayer(this.world.info.id, username);
        if (!user) {
            throw 'error_user_not_found'
        }
        await this.world.db.setAdmin(this.world.info.id, user.id, 1);
        this.updateWorldAdminForPlayer(user.id, true)
        return await this.load();
    }

    // Remove
    async remove(player, username) {
        if(!this.checkIsAdmin(player)) {
            throw 'error_not_permitted';
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
        return await this.load();
    }

    updateWorldAdminForPlayer(user_id: int, value: boolean) {
        for(const player of this.world.players.values()) {
            if(player.session.user_id == user_id) {
                player.state.world.is_admin = value
                player.sendState()
                break
            }
        }
    }

}