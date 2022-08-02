import { FSMBrain } from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { WorldAction } from "../../../www/js/world_action.js";

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

        this.widtn = 0.7;
        this.height = 1.3;

        this.follow_distance = 6;

        this.stack.pushState(this.doStand);
    }

    findTarget() {
        if (this.target == null) {
            const mob = this.mob;
            const players = this.getPlayersNear(mob.pos, this.follow_distance, false);
            let friends = [];
            for (let player of players) {
                if (player.state.hands.right.id == BLOCK.WHEAT.id) {
                    friends.push(player);
                }
            }
            if (friends.length > 0) {
                const rnd = (Math.random() * friends.length) | 0;
                const player = friends[rnd];
                this.target = player.session.user_id;
                this.stack.replaceState(this.doCatch);
                return true;
            }
        }
        return false;
    }

    doCatch(delta) {
        this.panick_timer = 0;

        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        const distance = mob.pos.distance(player.state.pos);
        if (!player || player.state.hands.right.id != BLOCK.WHEAT.id || player.game_mode.isSpectator() || distance > this.follow_distance) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return;
        }

        mob.rotate.z = this.angleTo(player.state.pos);

        const forward = (distance > 1.5) ? true : false;
        const block = this.getBeforeBlocks();
        const is_water = block.body.material.is_fluid;
        this.updateControl({
            yaw: mob.rotate.z,
            forward: forward,
            jump: is_water
        });

        this.applyControl(delta);
        this.sendState();
    }

    async onUse(actor, id) {
        if (!actor || !id) {
            return;
        }

        const mob = this.mob;
        const world = mob.getWorld();

        if (id == BLOCK.BUCKET.id) {
            const actions = new WorldAction();
            actions.putInBucket(BLOCK.BUCKET_MILK);
            world.actions_queue.add(actor, actions);
        }
    }

    async onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (actor != null) {
            const actions = new WorldAction();
            let drop_item = { pos: mob.pos, items: [] };

            const rnd_count_beef = ((Math.random() * 2) | 0) + 1;
            drop_item.items.push({ id: BLOCK.BEEF.id, count: rnd_count_beef });
           
            const rnd_count_leather = ((Math.random() * 2) | 0);
            if (rnd_count_leather != 0) {
                drop_item.items.push({ id: BLOCK.LEATHER.id, count: rnd_count_leather });
			}

            actions.addDropItem(drop_item);

            actions.addPlaySound({ tag: 'madcraft:block.cow', action: 'death', pos: mob.pos.clone() });

            world.actions_queue.add(actor, actions);
        }
    }

}