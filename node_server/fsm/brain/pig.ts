import { FSMBrain } from "../brain.js";
import { BLOCK } from "@client/blocks.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { EnumDamage } from "@client/enums/enum_damage.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        this.stack.pushState(this.doStand);
        this.targets = [
            BLOCK.CARROT.id,
            BLOCK.POTATO.id,
            BLOCK.BEETROOT.id
        ];
    }
    
    // Если убили моба
    onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        const actions = new WorldAction();
        const rnd_count_beef = (Math.random() * 2) | 0;
        actions.addDropItem({ 
            pos: mob.pos, 
            items: [
                {
                    id: type_damage != EnumDamage.FIRE ? BLOCK.BEEF.id : BLOCK.COOKED_BEEF.id,
                    count: rnd_count_beef + 1
                }
            ], 
            force: true 
        });
        actions.addPlaySound({ tag: 'madcraft:block.pig', action: 'death', pos: mob.pos.clone() });
        world.actions_queue.add(actor, actions);
    }
    
    // тег моба
    getTag() {
        return 'madcraft:block.pig';
    }

}