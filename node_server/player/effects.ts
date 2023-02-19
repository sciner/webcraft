import { ServerClient } from "../../www/src/server_client.js";
import type { ServerPlayer } from "../server_player.js";

const MUL_TICK_SECONDS = 20;

export class ServerPlayerEffects {
    player: ServerPlayer;
    world: any;
    effects: any[] = [];

    constructor(player : ServerPlayer) {
        this.player = player;
        this.world = player.world;
    }
    
    load() {
    }
    
    save() {
    }

    /*
    * Удаляем еффекты
    * id - id эффекта
    */
    delEffects(id) {
        for (const eff of this.effects) {
            if (eff.id == id || id == -1) {
                eff.time = 0;
                eff.level = 0;
            }
        }
    }
   
   /*
    * Добавляет новый еффект на игрока
    * effects - массив эффектов
    */
    addEffects(effects, ret = false) {
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
        const packet = { name: ServerClient.CMD_EFFECTS_STATE, data: { effects: this.effects}}
        if(ret) {
            return packet
        }
        world.sendSelected([packet], player);
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
           world.sendSelected([{ name: ServerClient.CMD_EFFECTS_STATE, data: { effects: this.effects}}], player);
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