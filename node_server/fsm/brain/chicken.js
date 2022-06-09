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
            baseSpeed: 1/2,
            playerHeight: 0.9,
            stepHeight: 1,
            playerHalfWidth: .25
        });

        this.widtn = 0.4;
        this.height = 0.7;
        this.follow_distance = 6;

        this.egg_timer = performance.now();
        this.lay_interval = 2000000;
        this.stack.pushState(this.doStand);
    }

    findTarget() {
        if (this.target == null) {
            const mob = this.mob;
            const players = this.getPlayersNear(mob.pos, this.follow_distance, false);
            let friends = [];
            for (let player of players) {
                if (player.state.hands.right.id == BLOCK.WHEAT_SEEDS.id) {
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

    doStand(delta) {
        super.doStand(delta);

        if ((performance.now() - this.egg_timer) > this.lay_interval) {
            this.stack.replaceState(this.doLayEgg);
        }
    }

    doCatch(delta) {
        this.panick_timer = 0;

        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        const distance = mob.pos.distance(player.state.pos);
        if (!player || player.state.hands.right.id != BLOCK.WHEAT_SEEDS.id || player.game_mode.isSpectator() || distance > this.follow_distance) {
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

    doLayEgg() {
        this.egg_timer = performance.now();
        const mob = this.mob;
        const world = mob.getWorld();

        const actions = new PickatActions();
        actions.addDropItem({ pos: mob.pos, items: [{ id: BLOCK.EGG.id, count: 1 }] , force: true});
        world.actions_queue.add(null, actions);

        this.stack.replaceState(this.doStand);
    }


    async onKill(actor, type_demage) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (actor != null) {
            const actions = new PickatActions();

            let drop_item = { pos: mob.pos, items: [] };
            drop_item.items.push({ id: BLOCK.CHICKEN.id, count: 1 });
            const rnd_count_feather = (Math.random() * 2) | 0;
            if (rnd_count_feather > 0) {
                drop_item.items.push({ id: BLOCK.FEATHER.id, count: rnd_count_feather });
            }
            actions.addDropItem(drop_item);

            actions.addPlaySound({ tag: 'madcraft:block.chicken', action: 'death', pos: mob.pos.clone() });

            world.actions_queue.add(actor, actions);
        }
    }

}