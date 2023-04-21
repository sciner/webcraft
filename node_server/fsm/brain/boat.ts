import { FSMBrain } from "../brain.js";
import { BLOCK } from "@client/blocks.js";
import { WorldAction } from "@client/world_action.js";
import type { EnumDamage } from "@client/enums/enum_damage.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.stack.pushState(this.doBoat);
        this.target = null
    }
    
    // Если убили моба
    onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        const actions = new WorldAction();
        actions.addDropItem({ 
            pos: mob.pos, 
            items: [
                {
                    id: BLOCK.OAK_BOAT.id,
                    count: 1
                }
            ], 
            force: true 
        });
        actions.addPlaySound({ tag: 'madcraft:block.pig', action: 'death', pos: mob.pos.clone() });
        world.actions_queue.add(actor, actions);
    }

    doBoat(delta) {
        const mob = this.mob;
        this.updateControl({
            yaw: mob.rotate.z,
            forward: true,
            jump: true,
            sneak: false
        });
        this.applyControl(delta);
        this.sendState();
        //if (Math.random() < 0.01) {
        this.stack.replaceState(this.doBoat2);
        //}
    }

    doBoat2(delta) {
        const mob = this.mob;
        this.updateControl({
            yaw: mob.rotate.z,
            forward: false,
            jump: false,
            sneak: false
        });
        this.applyControl(delta);
        this.sendState();
        if (Math.random() < 0.001) {
            this.stack.replaceState(this.doBoat);
            }
    }

    /**
    * Нанесен урон по мобу
    * val - количество урона
    * type_damage - от чего умер[упал, сгорел, утонул]
    * actor - игрок или пероснаж
    */
    onDamage(val : number, type_damage : EnumDamage, actor) {
        const mob = this.mob;
        this.onKill(actor, type_damage);
        mob.kill();
    }

    // паника моба от урона
    onPanic() {
    }

    /**
     * Использовать предмет на мобе
     * @param actor игрок
     * @param item item
     */
    onUse(actor : any, item : any) : boolean{
        actor.state.pos = this.mob.pos
        this.target = actor
        return false;
    }
    
}