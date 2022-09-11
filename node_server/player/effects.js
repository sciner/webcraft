import { ServerClient } from "../../www/js/server_client.js";

const MUL_TICK_SECONDS = 20;

export class Effect {
    
    static SPEED = 0;
    static SLOWNESS = 1;
    static HASTE = 2;
    static MINING_FATIGUE = 3;
    static STRENGTH = 4;
    static WEAKNESS = 5;
    static POISON = 6;
    static REGENERATION = 7;
    static INVISIBILITY = 8;
    static HUNGER = 9;
    static JUMP_BOOST = 10;
    static NAUSEA = 11;
    static NIGHT_VISION = 12;
    static BLINDNESS = 13;
    static RESISTANCE = 14;
    static FIRE_RESISTANCE = 15;
    static RESPIRATION = 16;
    static WITHER = 17;
    static ABSORPTION = 18;
    static LEVITIATION = 19;
    
    static get(id) {
        return [
            {id:0, negative: false, title: "Скорость"},
            {id:1, negative: true, title: "Замедление"},
            {id:2, negative: false, title: "Проворность"},
            {id:3, negative: true, title: "Усталость"},
            {id:4, negative: false, title: "Сила"},
            {id:5, negative: true, title: "Слабость"},
            {id:6, negative: true, title: "Отравление"},
            {id:7, negative: false, title: "Регенерация"},
            {id:8, negative: false, title: "Невидимость"},
            {id:9, negative: true, title: "Голод"},
            {id:10, negative: false, title: "Прыгучесть"},
            {id:11, negative: true, title: "Тошнота"},
            {id:12, negative: false, title: "Ночное зрение"},
            {id:13, negative: true, title: "Слепота"},
            {id:14, negative: false, title: "Сопротивление"},
            {id:15, negative: false, title: "Огнестойкость"},
            {id:16, negative: false, title: "Подводное дыхание"},
            {id:17, negative: true, title: "Иссушение"},
            {id:18, negative: false, title: "Поглощение"},
            {id:19, negative: true, title: "Левитация"},
        ];
    }
    
}

export class ServerPlayerEffects {
    
    constructor(player) {
        this.player = player;
        this.world = player.world;
        this.effects = [];
    }
    
    load() {
    
    }
    
    save() {
    
    }
   
   /*
    * Добавляет новый еффект на игрока
    * effects - массив эффектов
    */
    addEffects(effects) {
        const player = this.player;
        const world = player.world;
        for (const effect of effects) {
            let add = true;
            for (const eff of this.effects) {
                if (eff.id == effect.id) {
                    eff.time = Math.max(eff.time, effect.time * MUL_TICK_SECONDS);
                    eff.level = Math.max(eff.level, effect.level);
                    add = false;
                    break;
                }
            }
            if (add) {
                this.effects.push({
                    id: effect.id,
                    time: effect.time * MUL_TICK_SECONDS,
                    level: effect.level
                });
            }
        }
        world.sendSelected([{ name: ServerClient.CMD_EFFECTS_STATE, data: { effects: this.effects}}], [player.session.user_id]);
    }
    
    // проверка времени наложенных эффектов
    checkEffects() {
        const player = this.player;
        const world = player.world;
        let send = false;
        for (let i = 0; i < this.effects.length; i++) {
            if (this.effects[i].time > 0) {
                this.effects[i].time--;
            } else {
                this.effects.splice(i, 1);
                send = true;
            }
        }
        if (send) {
            // @todo пока тут проверям конец, потом перикунуть на клиент
           world.sendSelected([{ name: ServerClient.CMD_EFFECTS_STATE, data: { effects: this.effects}}], [player.session.user_id]);
        }
    }
    
     /*
    * Проверям наличие эффекта
    * val - сам эффект
    */
    getEffectLevel(val) {
        for (const effect of this.effects) {
            if (effect.id == val) {
                return effect.level;
            }
        }
        return 0;
    }
    
}