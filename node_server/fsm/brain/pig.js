import {FSMBrain} from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { PickatActions } from "../../../www/js/block_action.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this,{
            baseSpeed: 1/4,
            playerHeight: 0.9,
            stepHeight: 1,
            playerHalfWidth: .5
        });

        this.live = 10;
        this.follow_distance = 16;

        // Начинаем с просто "Стоять"
        this.stack.pushState(this.doStand);
    }

    findTarget() {
        if (this.target == null) {
            const mob = this.mob;
            const players = this.getPlayersNear(mob.pos, this.follow_distance, false);
            let friends = [];
            for (let player of players) {
                if (player.state.hands.right.id == BLOCK.CARROT.id) {
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

    async doCatch(delta) {
        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        if (!player || player.state.hands.right.id != BLOCK.CARROT.id || player.game_mode.isSpectator()) {
            this.target = null;
            this.isStand(1.0);
            this.sendState();
            return;
        }

        if (Math.random() < 0.5) {
            this.mob.rotate.z = this.angleTo(player.state.pos);
        }

        const forward = (mob.pos.distance(player.state.pos) > 1.5) ? true : false;

        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: forward,
            jump: this.checkInWater()
        });

        this.applyControl(delta);
        this.sendState();
    }


    async onKill(owner, type) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (owner != null) {
            const actions = new PickatActions();
            const rnd_count_porkchop = ((Math.random() * 2) | 0) + 1;

            let items = { pos: mob.pos, items: [] };
            items.items.push({ id: BLOCK.PORKCHOP.id, count: rnd_count_porkchop });

            actions.addDropItem(items);

            actions.addPlaySound({ tag: 'madcraft:block.pig', action: 'hurt', pos: mob.pos.clone() }); //Звук смерти

            await world.applyActions(owner, actions);
        }
    }

}