import { FSMBrain } from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { WorldAction } from "../../../www/js/world_action.js";
import { EnumDamage } from "../../../www/js/enums/enum_damage.js";

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
        
        this.health = 10; // максимальное здоровье
        this.distance_view = 6; // дистанция на которм виден игрок
        this.targets = [
            BLOCK.WHEAT.id
        ];
    }

    // если подоили корову
    onUse(actor, id) {
        if (!actor || !id || id != BLOCK.BUCKET.id) {
            return;
        }
        const mob = this.mob;
        const world = mob.getWorld();
        const actions = new WorldAction();
        actions.putInBucket(BLOCK.BUCKET_MILK);
        world.actions_queue.add(actor, actions);
    }
    
    // Если убили моба
    onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        const items = [];
        const actions = new WorldAction();
        const rnd_count_beef = (Math.random() * 2) | 0;
        items.push({ id: type_damage != EnumDamage.FIRE ? BLOCK.BEEF.id : BLOCK.COOKED_BEEF.id, count: rnd_count_beef + 1 });
        const rnd_count_leather = ((Math.random() * 2) | 0);
        if (rnd_count_leather != 0) {
            items.push({ id: BLOCK.LEATHER.id, count: rnd_count_leather });
        }
        actions.addDropItem({ pos: mob.pos, items: items, force: true });
        actions.addPlaySound({ tag: 'madcraft:block.sheep', action: 'death', pos: mob.pos.clone() });
        world.actions_queue.add(actor, actions);
    }

}