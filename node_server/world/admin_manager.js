export class WorldAdminManager {
    constructor(world) {
        this.world = world;
    }

    // Load
    async load() {
        return (this.list = await this.world.db.loadAdminList(
            this.world.info.id,
        ));
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
        if (!this.checkIsAdmin(player)) {
            return null;
        }
        const user = await this.world.db.findPlayer(
            this.world.info.id,
            username,
        );
        if (!user) {
            return null;
        }
        await this.world.db.setAdmin(this.world.info.id, user.id, 1);
        return await this.load();
    }

    // Remove
    async remove(player, username) {
        if (!this.checkIsAdmin(player)) {
            throw 'error_not_permitted';
        }
        const user = await this.world.db.findPlayer(
            this.world.info.id,
            username,
        );
        if (!user) {
            throw 'User not found';
        }
        if (user.id == this.world.info.user_id) {
            throw "Can't remove owner";
        }
        await this.world.db.setAdmin(this.world.info.id, user.id, 0);
        return await this.load();
    }
}
