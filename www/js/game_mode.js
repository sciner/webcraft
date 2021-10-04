export const GAME_MODE = {};
    GAME_MODE.CREATIVE = 'creative';
    GAME_MODE.SURVIVAL = 'survival';
    GAME_MODE.ADVENTURE = 'adventure';
    GAME_MODE.SPECTATOR = 'spectator';

export class GameMode {

    constructor(world, game_mode_id) {
        this.world = world;
        this.modes = [];
        this.add({id: GAME_MODE.SURVIVAL, title: 'Survival', can_fly: false, block_action: true, block_clone: false});
        this.add({id: GAME_MODE.CREATIVE, title: 'Creative', can_fly: true, block_action: true, block_clone: true});
        this.add({id: GAME_MODE.ADVENTURE, title: 'Adventure', can_fly: false, block_action: false, block_clone: false});
        this.add({id: GAME_MODE.SPECTATOR, title: 'Spectator', can_fly: true, block_action: false, block_clone: false});
        if(game_mode_id) {
            this.setMode(game_mode_id);
        }
    }

    // Добавление режима игры
    add(mode) {
        if(!this.current) {
            this.current = mode;
        }
        this.modes.push(mode);
    }

    getCurrent() {
        return this.current;
    }

    // Выживание
    isSurvival() {
        return this.current.id == GAME_MODE.SURVIVAL;
    }

    // Наблюдатель
    isSpectator() {
        return this.current.id == GAME_MODE.SPECTATOR;
    }

    // Творчество
    isCreative() {
        return this.current.id == GAME_MODE.CREATIVE;
    }

    canFly() {
        return this.getCurrent().can_fly;
    }

    canBlockAction() {
        return this.getCurrent().block_action;
    }

    canBlockClone() {
        return this.getCurrent().block_clone;
    }

    // Смена режима игры
    setMode(id) {
        for(let mode of this.modes) {
            if(mode.id == id) {
                this.current = mode;
                let player = this.world.localPlayer;
                if(player) {
                    if(!mode.can_fly) {
                        player.setFlying(false);
                    } else if(id == GAME_MODE.SPECTATOR) {
                        player.setFlying(true);
                    }
                    player.chat.messages.addSystem('Game mode changed to ... ' + this.getCurrent().title);
                }
                return true;
            }
        }
    }

    // Переключить на следующий игровой режим
    next() {
        let index = 0;
        for(let mode of this.modes) {
            index++;
            if(mode.id == this.getCurrent().id) {
                break;
            }
        }
        let id = this.modes[index % this.modes.length].id;
        this.setMode(id);
    }

}