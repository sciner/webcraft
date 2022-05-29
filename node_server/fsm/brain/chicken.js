import {FSMBrain} from "../brain.js";
import {BLOCK} from "../../../www/js/blocks.js";
import {Vector} from "../../../www/js/helpers.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 1/2,
            playerHeight: 0.8,
            stepHeight: 1,
            playerHalfWidth: .25
        });
        
        this.egg_timer = performance.now();
        this.lay_interval = 200000;
        this.follow_distance = 20;
        this.target = null;
        
        // Начинаем с просто "Стоять"
        this.stack.pushState(this.doStand);
    }
    
    findTarget() {
        if (this.target == null) {
            const mob = this.mob;
            const players = this.getPlayersNear(mob.pos, this.follow_distance, true);
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
    
    async doCatch(delta) {
        
        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: true,
            jump: this.checkInWater()
        });

        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        if(!player || player.state.hands.right.id != BLOCK.WHEAT_SEEDS.id) {
            this.target = null;
            this.isStand(1.0);
            this.sendState();
            return;
        }

        if (Math.random() < 0.5) {
            this.mob.rotate.z = this.angleTo(player.state.pos);
        }

        this.applyControl(delta);
        this.sendState();
    }
    
    doStand(delta) {
        super.doStand(delta);
      
        if ((performance.now() - this.egg_timer) > this.lay_interval) {
            this.stack.replaceState(this.doLayEgg);
        }
    }
    
    doLayEgg(delta) {
        this.egg_timer = performance.now();
        const mob = this.mob;
        const world = mob.getWorld();
        world.createDropItems(null, mob.pos.add(new Vector(0, 0.5, 0)), [{id: BLOCK.EGG.id, count: 1}], new Vector(0, 0, 0));
        this.isRotate(1.0);
    }
    
    onKill(owner, type) {
        const mob = this.mob;
        const world = mob.getWorld();
        let items = [];
        let velocity = new Vector(0,0,0);
        if (owner != null) {
            //owner это игрок
            if (owner.session) {
                items.push({id: BLOCK.CHICKEN.id, count: 1});
                const rnd_count_feather = (Math.random() * 2) | 0;
                if (rnd_count_feather > 0) {
                    items.push({id: BLOCK.FEATHER.id, count: rnd_count_feather});
                }
                velocity = owner.state.pos.sub(mob.pos).normal().multiplyScalar(.5);
            }
            world.createDropItems(owner, mob.pos.add(new Vector(0, 0.5, 0)), items, velocity);
        }
    }

}