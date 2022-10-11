import { FSMBrain } from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { WorldAction } from "../../../www/js/world_action.js";
import { ServerClient } from "../../../www/js/server_client.js";

const TIME_IN_NEST = 12000;
const LAY_INTERVAL = 100000;
const COUNT_EGGS_IN_NEST = 8;

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
        
        this.follow_distance = 6;

        this.egg_timer = performance.now();
        
        // nest
        this.nest_timer = 0;
        this.nest = null;
        
        this.stack.pushState(this.doStand);
    }

    findTarget() {
        if (this.target == null) {
            const mob = this.mob;
            const players = this.getPlayersNear(mob.pos, this.follow_distance, false);
            const friends = [];
            for (const player of players) {
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

    doForward(delta) {
        if ((performance.now() - this.egg_timer) > LAY_INTERVAL) {
            const block = this.getBeforeBlocks();
            if (!block) {
                return;
            }
            if (block.body.id == BLOCK.CHICKEN_NEST.id && block.body.extra_data.eggs < COUNT_EGGS_IN_NEST) {
                this.egg_timer = performance.now();
                this.nest_timer = performance.now();
                this.nest = block.body;
                this.stack.replaceState(this.doLay);
                return;
            }
        }
        super.doForward(delta);
    }
    
    // Процесс сноса яйца
    doLay(delta) {
        if (!this.nest || this.nest.extra_data.eggs >= COUNT_EGGS_IN_NEST) {
            this.stack.replaceState(this.doForward);
            return;
        }
        const mob = this.mob;
        const nest_pos = this.nest.posworld.offset(0.5, 0.5, 0.5);
        const distance =  mob.pos.horizontalDistance(nest_pos);
        if (distance < 0.1) {
            if ((performance.now() - this.nest_timer) > TIME_IN_NEST) {
                const world = mob.getWorld();
                const actions = new WorldAction();
                actions.addBlocks([{
                    pos: this.nest.posworld, 
                    item: {
                        id : BLOCK.CHICKEN_NEST.id,
                        extra_data: {
                            eggs: this.nest.extra_data.eggs + 1
                        }
                    }, 
                    action_id: ServerClient.BLOCK_ACTION_MODIFY
                }]);
                world.actions_queue.add(null, actions);
                this.stack.replaceState(this.doForward);
            }
            return;
        }
        
        mob.rotate.z = this.angleTo(nest_pos);

        this.updateControl({
            yaw: mob.rotate.z,
            forward: true,
            jump: false
        });

        this.applyControl(delta);
        this.sendState();
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
        const is_water = block.body.is_fluid;
        this.updateControl({
            yaw: mob.rotate.z,
            forward: forward,
            jump: is_water
        });

        this.applyControl(delta);
        this.sendState();
    }

    async onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (actor != null) {
            const actions = new WorldAction();

            const drop_item = { pos: mob.pos, items: [] };
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