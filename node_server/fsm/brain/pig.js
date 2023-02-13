import { FSMBrain } from '../brain.js';
import { BLOCK } from '../../../www/js/blocks.js';
import { Vector } from '../../../www/js/helpers.js';
import { WorldAction } from '../../../www/js/world_action.js';
import { EnumDamage } from '../../../www/js/enums/enum_damage.js';

export class Brain extends FSMBrain {
    constructor(mob) {
        super(mob);
        //
        this.prevPos = new Vector(mob.pos);
        this.lerpPos = new Vector(mob.pos);
        this.pc = this.createPlayerControl(this, {
            baseSpeed: 1 / 4,
            playerHeight: 1.125,
            stepHeight: 1,
            playerHalfWidth: 0.45,
        });
        this.stack.pushState(this.doStand);
        this.health = 10; // максимальное здоровье
        this.distance_view = 6; // дистанция на которм виден игрок
        this.targets = [BLOCK.CARROT.id, BLOCK.POTATO.id, BLOCK.BEETROOT.id];
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
                    id:
                        type_damage != EnumDamage.FIRE
                            ? BLOCK.BEEF.id
                            : BLOCK.COOKED_BEEF.id,
                    count: rnd_count_beef + 1,
                },
            ],
            force: true,
        });
        actions.addPlaySound({
            tag: 'madcraft:block.pig',
            action: 'death',
            pos: mob.pos.clone(),
        });
        world.actions_queue.add(actor, actions);
    }

    // тег моба
    getTag() {
        return 'madcraft:block.pig';
    }
}
