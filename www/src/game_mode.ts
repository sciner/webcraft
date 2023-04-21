export enum GAME_MODE {
    CREATIVE = 'creative',
    SURVIVAL = 'survival',
    ADVENTURE = 'adventure',
    SPECTATOR = 'spectator',
}

type GameModeData = {
    id              : GAME_MODE
    index ?         : int
    title           : string
    can_fly         : boolean
    block_action    : boolean
    block_clone     : boolean
    pickat_distance : number
    can_take_damage : boolean
    asphyxiation    : boolean
    pickup_items    : boolean
    drop_items      : boolean
}

export class GameMode {

    static SURVIVAL: GameModeData = {
        id: GAME_MODE.SURVIVAL,
        title: 'Survival',
        can_fly: false,
        block_action: true,  block_clone: false,
        pickat_distance: 5,
        can_take_damage: true, asphyxiation: true,
        pickup_items: true, drop_items: true
    }
    static CREATIVE: GameModeData = {
        id: GAME_MODE.CREATIVE,
        title: 'Creative',
        can_fly: true,
        block_action: true, block_clone: true,
        pickat_distance: 10,
        can_take_damage: false, asphyxiation: false,
        pickup_items: true, drop_items: true,
    }
    static ADVENTURE: GameModeData = {
        id: GAME_MODE.ADVENTURE,
        title: 'Adventure',
        can_fly: false,
        block_action: false, block_clone: false,
        pickat_distance: 5,
        can_take_damage: true, asphyxiation: true,
        pickup_items: false, drop_items: false
    }
    static SPECTATOR: GameModeData = {
        id: GAME_MODE.SPECTATOR,
        title: 'Spectator',
        can_fly: true,
        block_action: false, block_clone: false,
        pickat_distance: 5,
        can_take_damage: false, asphyxiation: false,
        pickup_items: false, drop_items: false
    }

    static byIndex: GameModeData[] = [this.SURVIVAL, this.CREATIVE, this.ADVENTURE, this.SPECTATOR]
    static byId: { [id: string]: GameModeData } = { }

    static initStatics() {
        for(let i = 0; i < this.byIndex.length; i++) {
            const mode = this.byIndex[i]
            mode.index = i
            this.byId[mode.id] = mode
        }
    }

    player
    onSelect: (GameModeData) => void
    current: GameModeData

    constructor(player : any, game_mode_id : GAME_MODE | string) {
        this.player = player;
        this.onSelect = (mode: GameModeData) => {};
        game_mode_id = game_mode_id ?? GameMode.byIndex[0].id;
        this.applyMode(game_mode_id, false);
    }

    // Return active game mode
    getCurrent(): GameModeData {
        return this.current;
    }

    getById(game_mode_id: string): GameModeData | undefined {
        return GameMode.byId[game_mode_id]
    }

    // Игрок может получить урон
    mayGetDamaged(): boolean {
        return this.current.can_take_damage
    }

    // Выживание
    isSurvival(): boolean {
        return this.current === GameMode.SURVIVAL;
    }

    // Наблюдатель
    isSpectator(): boolean {
        return this.current === GameMode.SPECTATOR;
    }

    // Творчество
    isCreative(): boolean {
        return this.current === GameMode.CREATIVE;
    }

    // Позволяет ли текущий режим полёты
    canFly(): boolean {
        return this.current.can_fly;
    }

    // Позволяет ли текущий режим совершать действия с блоками
    canBlockAction(): boolean {
        return this.current.block_action && !this.player.driving;
    }

    // Позволяет ли текущий режим клонировать блоки
    canBlockClone(): boolean {
        return this.current.block_clone;
    }

    // Запрос смена режима игры на сервер
    setMode(id: GAME_MODE): void {
        return this.player.world.server.GameModeSet(id);
    }

    // Применение указанного режима игры
    applyMode(id: GAME_MODE | string, notify: boolean): boolean {
        const mode = GameMode.byId[id]
        if (mode == null) {
            return false
        }
        this.current = mode;
        if(notify) {
            this.onSelect(mode);
        }
        return true;
    }

    // Переключить на следующий игровой режим
    next(return_only = false): GameModeData {
        const mode = GameMode.byIndex[(this.current.index + 1) % GameMode.byIndex.length]
        if(!return_only) {
            this.applyMode(mode.id, true)
        }
        return mode
    }

    // getPickatDistance...
    getPickatDistance(): number {
        return this.current.pickat_distance;
    }

    // Может подбирать валяющиеся предметы
    canPickupItems(): boolean {
        return this.current.pickup_items;
    }

    // Может выкидывать предметы из инвентаря
    canDropItems(): boolean {
        return this.current.drop_items;
    }

}

GameMode.initStatics()