export const GAME_MODE = {};
    GAME_MODE.CREATIVE = 'creative';
    GAME_MODE.SURVIVAL = 'survival';
    GAME_MODE.SPECTATOR = 'spectator';
    GAME_MODE._DEFAULT = GAME_MODE.CREATIVE;

export class GameMode {

    constructor(world, game_mode_id) {
        this.world = world;
        this.game_mode = game_mode_id ? game_mode_id : GAME_MODE._DEFAULT;
        this.modes = {
            creative: {id: GAME_MODE.CREATIVE, title: 'Creative'},
            survival: {id: GAME_MODE.SURVIVAL, title: 'Survival'},
            spectator: {id: GAME_MODE.SPECTATOR, title: 'Spectator'},
        };
    }

    getCurrent() {
        return this.modes[this.game_mode];
    }

    // Наблюдатель
    isSpectator() {
        return this.game_mode == GAME_MODE.SPECTATOR;
    }

    // Творчество
    isCreative() {
        return this.game_mode == GAME_MODE.CREATIVE;
    }

    // Выживание
    isSurvival() {
        return this.game_mode == GAME_MODE.SURVIVAL;
    }

    //
    setMode(value) {
        let player = this.world.localPlayer;
        player.flying = value == GAME_MODE.SPECTATOR;
        this.game_mode = value;
        player.chat.messages.addSystem('Game mode changed to ... ' + this.getCurrent().title);
        return true;
    }

    //
    toggleSpectator() {
        if(this.game_mode == GAME_MODE.SPECTATOR) {
            return this.setMode(GAME_MODE._DEFAULT);
        }
        return this.setMode(GAME_MODE.SPECTATOR);
    }

}