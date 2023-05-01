import { FSMBrain } from "../brain.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { EnumDamage } from "@client/enums/enum_damage.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 1/4,
            playerHeight: 1.4,
            stepHeight: 1,
            playerHalfWidth: .45
        });
        this.stack.pushState(this.doStand);
        this.setMaxHealth(10) // максимальное здоровье
        this.distance_view = 6; // дистанция на которм виден игрок
        this.targets = [
            mob.getWorld().block_manager.WHEAT.id
        ];
    }

    // если подоили корову
    onUse(actor, id) {
        const mob = this.mob;
        const world = mob.getWorld();
        const bm = world.block_manager
        if (!actor || !id || id != bm.BUCKET.id) {
            return;
        }
        const actions = new WorldAction();
        actions.putInBucket(bm.BUCKET_MILK);
        world.actions_queue.add(actor, actions);
        return false;
    }
    
    // Если убили моба
    onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        const bm = world.block_manager
        const items = [];
        const actions = new WorldAction();
        const rnd_count_beef = (Math.random() * 2) | 0;
        items.push({ id: type_damage != EnumDamage.FIRE ? bm.BEEF.id : bm.COOKED_BEEF.id, count: rnd_count_beef + 1 });
        const rnd_count_leather = ((Math.random() * 2) | 0);
        if (rnd_count_leather != 0) {
            items.push({ id: bm.LEATHER.id, count: rnd_count_leather });
        }
        actions.addDropItem({ pos: mob.pos, items: items, force: true });
        actions.addPlaySound({ tag: 'madcraft:block.cow', action: 'death', pos: mob.pos.clone() });
        world.actions_queue.add(actor, actions);
    }

}