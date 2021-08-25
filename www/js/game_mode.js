export const GAME_MODE = {};
    GAME_MODE.CREATIVE = 'creative';
    GAME_MODE.SURVIVAL = 'survival';
    GAME_MODE.SPECTATOR = 'spectator';
    GAME_MODE._DEFAULT = GAME_MODE.CREATIVE;

export class GameMode {

    constructor(world) {
        this.world = world;
        this.game_mode = GAME_MODE._DEFAULT;
    }

    isSpectator() {
        return this.game_mode == GAME_MODE.SPECTATOR;
    }

    //
    setMode(value) {
        let player = this.world.localPlayer;
        player.flying = value == GAME_MODE.SPECTATOR;
        player.chat.messages.addSystem('Game mode changed to ... ' + value);
        return this.game_mode = value;
    }

    //
    toggleSpectator() {
        if(this.game_mode == GAME_MODE.SPECTATOR) {
            return this.setMode(GAME_MODE._DEFAULT);
        }
        return this.setMode(GAME_MODE.SPECTATOR);
    }

}