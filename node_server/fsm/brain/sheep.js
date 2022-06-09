import {FSMBrain} from "../brain.js";
import {BLOCK} from "../../../www/js/blocks.js";
import {Vector} from "../../../www/js/helpers.js";
import {ServerClient} from "../../../www/js/server_client.js";
import {PickatActions} from "../../../www/js/block_action.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 1/4,
            playerHeight: 1.3,
            stepHeight: 1,
            playerHalfWidth: .5
        });
        this.widtn = 0.6;
        this.height = 1.2;
        
        this.color = 0;
        this.count_grass = 0;
        this.target = null;
        this.follow_distance = 6;
        
        this.stack.pushState(this.doStand);
    }

    get is_shaered() {
        return !!this.mob.extra_data?.is_shaered;
    }

    set is_shaered(value) {
        this.mob.extra_data.is_shaered = value;
    }
    
    findTarget() {
        if (this.target == null) {
            const mob = this.mob;
            const players = this.getPlayersNear(mob.pos, this.follow_distance, true);
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
    
    doStand(delta) {
        super.doStand(delta);

        if (this.is_shaered && Math.random() < 0.8) {
            this.stack.replaceState(this.doEat);
        }
    }
   
    async doEat(delta) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (this.count_grass > 5) {
            this.count_grass = 0;
            this.is_shaered = false;
        }
        if (this.is_shaered) {
            const block = this.getBeforeBlocks();
            if (block.body.id == BLOCK.TALL_GRASS.id) {
                const actions = new PickatActions();
                actions.addBlocks([
                    {
                        pos: block.body.posworld, 
                        item: {id : BLOCK.AIR.id}, 
                        action_id: ServerClient.BLOCK_ACTION_REPLACE
                    }
                ]);
                world.actions_queue.add(null, actions); 
                this.count_grass++;
            } else {
                if (block.legs.id == BLOCK.GRASS_DIRT.id) {
                    const actions = new PickatActions();
                    actions.addBlocks([
                        {
                            pos: block.legs.posworld, 
                            item: {id : BLOCK.DIRT.id}, 
                            action_id: ServerClient.BLOCK_ACTION_REPLACE
                        }
                    ]);
                    world.actions_queue.add(null, actions); 
                    this.count_grass++;
                }
            }
        }
        this.stack.replaceState(this.doForward);
    }
    
     // Chasing a player
    async doCatch(delta) {
        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        const distance = mob.pos.distance(player.state.pos);
        if(!player || player.state.hands.right.id != BLOCK.WHEAT.id || player.game_mode.isSpectator() || distance > this.follow_distance) {
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
        if (!actor || !id){
            return;
        }
        
        const mob = this.mob;
        const world = mob.getWorld();
        
        if (id == BLOCK.SHEARS.id && !this.is_shaered) {
            this.is_shaered = true;
            const actions = new PickatActions();

            const rnd_count = ((Math.random() * 2) | 0) + 1;
            actions.addDropItem({ pos: mob.pos, items: [{ id: 350, count: rnd_count }] });

            world.actions_queue.add(actor, actions);
        }
    }
    
    async onKill(actor, type_demage) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (actor != null) {
            const actions = new PickatActions();
            const rnd_count_mutton = ((Math.random() * 2) | 0) + 1;

            let drop_item = { pos: mob.pos, items: [] };
            drop_item.items.push({ id: BLOCK.MUTTON.id, count: rnd_count_mutton });
            if (!this.is_shaered) {
                drop_item.items.push({ id: 350, count: 1 });
            }
            actions.addDropItem(drop_item);

            actions.addPlaySound({ tag: 'madcraft:block.sheep', action: 'death', pos: mob.pos.clone() });

            world.actions_queue.add(actor, actions);
        }
    }
    
}