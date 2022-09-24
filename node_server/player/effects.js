import { ServerClient } from "../../www/js/server_client.js";

const MUL_TICK_SECONDS = 20;

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
            if (this.effects[i].time >= 0) {
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