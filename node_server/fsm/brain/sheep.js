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
        
        this.color = 0;
        this.count_grass = 0;
        this.target = null;
        this.follow_distance = 10;
        
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
    
    doStand(delta) {
        super.doStand(delta);
        
        if (this.is_shaered) {
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
            let pos = mob.pos.sub(new Vector(0, 1, 0)).flooredSelf();
            if (world.getBlock(pos).id == BLOCK.GRASS_DIRT.id) {
                const actions = new PickatActions();
                actions.addBlocks([
                    {
                        pos: pos, 
                        item: {id : BLOCK.DIRT.id}, 
                        action_id: ServerClient.BLOCK_ACTION_REPLACE
                    }
                ]);
                await world.applyActions(null, actions); 
                this.count_grass++;
            }
            pos = mob.pos.flooredSelf();
            if (world.getBlock(pos).id == BLOCK.TALL_GRASS.id) {
                const actions = new PickatActions();
                actions.addBlocks([
                    {
                        pos: pos, 
                        item: {id : BLOCK.AIR.id}, 
                        action_id: ServerClient.BLOCK_ACTION_REPLACE
                    }
                ]);
                await world.applyActions(null, actions); 
                this.count_grass++;
            }
        }
        this.isRotate(1.0);
    }
    
     // Chasing a player
    async doCatch(delta) {
        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        if(!player || player.state.hands.right.id != BLOCK.WHEAT.id || player.game_mode.isSpectator()) {
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

            await world.applyActions(actor, actions);
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

            actions.addPlaySound({ tag: 'madcraft:block.sheep', action: 'hurt', pos: mob.pos.clone() }); //Звук смерти

            await world.applyActions(actor, actions);
        }
    }
    
}