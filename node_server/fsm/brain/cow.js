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

    async onUse(owner, id) {
        if (!owner || !id) {
            return;
        }

        const mob = this.mob;
        const world = mob.getWorld();

        if (id == BLOCK.BUCKET_EMPTY.id) {
            const actions = new PickatActions();
            actions.putInBucket(BLOCK.BUCKET_MILK);
            await world.applyActions(owner, actions);
        }
    }

    async onKill(owner, type) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (owner != null) {
            const actions = new PickatActions();
            let items = { pos: mob.pos, items: [] };

            const rnd_count_beef = ((Math.random() * 2) | 0) + 1;
            items.items.push({ id: BLOCK.BEEF.id, count: rnd_count_beef });
           
            const rnd_count_leather = ((Math.random() * 2) | 0);
            if (rnd_count_leather != 0) {
                items.items.push({ id: BLOCK.LEATHER.id, count: rnd_count_leather });
			}

            actions.addDropItem(items);

            actions.addPlaySound({ tag: 'madcraft:block.cow', action: 'hurt', pos: mob.pos.clone() }); //Звук смерти

            await world.applyActions(owner, actions);
        }
    }

}