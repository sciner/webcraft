import {FSMBrain} from "../brain.js";

import {Vector} from "../../../www/js/helpers.js";

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
        
        this.live = 8;
        this.demage = 0;
        
        this.color = 0;
        this.is_shaered = false;
        this.count_grass = 0;
        
        this.stack.pushState(this.doStand);
        
    }
    
    onEat(){
        const mob = this.mob;
        const world = mob.getWorld();
        if (this.is_shaered){
            if (this.count_grass > 5) {
                this.count_grass = 0;
                this.is_shaered = false;
            }
            this.count_grass++;
            const pos_block = mob.pos.addSelf(new Vector(0, -1, 0));
            console.log(pos_block);
            console.log(world.getBlock(pos_block));
        }
    }
    
    onUse(owner, item){
        this.onEat();
        const mob = this.mob;
        const world = mob.getWorld();
       
        if (item.id == 552 && !this.is_shaered) {
            this.is_shaered = true; 
            let velocity = new Vector(
                -Math.sin(mob.rotate.z),
                0,
                -Math.cos(mob.rotate.z)
            ).multiplyScalar(0.5);
            const rnd_count = ((Math.random() * 2) | 0) + 1;
            let items = [
                {
                    id: 350, 
                    count: rnd_count
                }
            ];
            world.createDropItems(owner, mob.pos.addSelf(new Vector(0, 0.5, 0)), items, velocity);
        }
    }
    
    onKill(owner, type) {
        const mob = this.mob;
        const world = mob.getWorld();
        let velocity = new Vector(
            -Math.sin(mob.rotate.z),
            0,
            -Math.cos(mob.rotate.z)
        ).multiplyScalar(0.5);
        let items = [];
        if (owner != null) {
            //owner это игрок
            if (owner.session) {
                const rnd_count = (Math.random() * 2) | 0;
                if (rnd_count > 0){ 
                    items.push({id: 350, count: rnd_count});
                }
            }
        }
        if (items.length > 0){
            world.createDropItems(owner, mob.pos.addSelf(new Vector(0, 0.5, 0)), items, velocity);
        }
    }
    
}