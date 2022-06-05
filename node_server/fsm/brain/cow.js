import { FSMBrain } from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { PickatActions } from "../../../www/js/block_action.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 1/4,
            playerHeight: 1.4,
            stepHeight: 1,
            playerHalfWidth: .5
        });
        // Начинаем с просто "Стоять"
        this.stack.pushState(this.doStand);
    }

    async onUse(actor, id) {
        if (!actor || !id) {
            return;
        }

        const mob = this.mob;
        const world = mob.getWorld();

        if (id == BLOCK.BUCKET_EMPTY.id) {
            const actions = new PickatActions();
            actions.putInBucket(BLOCK.BUCKET_MILK);
            await world.applyActions(actor, actions);
        }
    }

    async onKill(actor, type_demage) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (actor != null) {
            const actions = new PickatActions();
            let drop_item = { pos: mob.pos, items: [] };

            const rnd_count_beef = ((Math.random() * 2) | 0) + 1;
            drop_item.items.push({ id: BLOCK.BEEF.id, count: rnd_count_beef });
           
            const rnd_count_leather = ((Math.random() * 2) | 0);
            if (rnd_count_leather != 0) {
                drop_item.items.push({ id: BLOCK.LEATHER.id, count: rnd_count_leather });
			}

            actions.addDropItem(drop_item);

            actions.addPlaySound({ tag: 'madcraft:block.cow', action: 'hurt', pos: mob.pos.clone() }); //Звук смерти

            await world.applyActions(actor, actions);
        }
    }

}