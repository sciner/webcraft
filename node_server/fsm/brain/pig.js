import { FSMBrain } from "../brain.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { Vector } from "../../../www/js/helpers.js";
import { WorldAction } from "../../../www/js/world_action.js";
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../../www/js/fluid/FluidConst.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this,{
            baseSpeed: 1/4,
            playerHeight: 0.5,
            stepHeight: 1,
            playerHalfWidth: .5
        });
        
        this.stack.pushState(this.doStand);
        
        // куда двигаться
        this.goto = null;
        
        // таймеры
        this.timer_reset = 0;
    }
    
    // Метод для возобновления жизни, урона и т.д.
    onUpdate(delta) {
        const mob = this.mob;
        const world = mob.getWorld();
        const chunk = world.chunks.get(mob.chunk_addr);
        if (!chunk) {
            return;
        }
        const head = chunk.getBlock(mob.pos.offset(0, this.pc.playerHeight + 1, 0).floored());
        this.in_water = (head && head.id == 0 && (head.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID);
       // console.log('in_water: ' + this.in_water);
        
        //this.in_fire = (legs && legs.id == BLOCK.FIRE.id);
        //this.in_lava = (legs && legs.id == 0 && (legs.fluid & FLUID_TYPE_MASK) === FLUID_LAVA_ID);
        //this.is_wall = ahead.id != 0 && ahead.id != -1 && ahead.material.style != 'planting';
        //this.is_abyss = under.id == 0 && abyss.id == 0;
        if (this.timer_reset++ > 5 * 20) {
            this.to = null;
        }
    }
    
    // просто стоит
    doStand(delta) {
        this.timer_reset = 0;
        this.onUpdate(delta);
        const mob = this.mob;
        if (this.in_water) {
            this.stack.replaceState(this.doFindGround);
            return;
        }
        this.updateControl({
            yaw: mob.rotate.z,
            forward: false
        });
        this.applyControl(delta);
        this.sendState();
    }
    
    // поиск суши
    doFindGround(delta) {
        this.onUpdate(delta);
        const mob = this.mob;
        if (!this.to) {
            mob.rotate.z += (Math.random() * Math.PI / 12);
            // определяем берег
            const ray = this.raycastFromHead();
            if (ray) {
                const pos = new Vector(ray.x, ray.y, ray.z);
                if (this.isGround(pos) && !this.isGround(pos.offset(0, 1, 0)) && !this.isGround(pos.offset(0, 2, 0))) {
                    this.to = pos;
                    return;
                }
            }
        } else {
            mob.rotate.z = this.angleTo(this.to);
            const distance = mob.pos.distance(this.to);
            console.log(distance)
        }
        this.updateControl({
            yaw: mob.rotate.z,
            forward: false,
            jump: true
        });
        this.applyControl(delta);
        this.sendState();
    }
   
    isGround(pos) {
        const block = this.mob.getWorld().getBlock(pos);
        return (block.id != BLOCK.AIR.id && block.material.style != 'planting');
        //console.log(block.material.name + ' ' + block.fluid + ' ' + block.material.style);
    }
    
/*
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
        this.panick_timer = 0;

        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        const distance = mob.pos.distance(player.state.pos);
        if (!player || player.state.hands.right.id != BLOCK.CARROT.id || player.game_mode.isSpectator() || distance > this.follow_distance) {
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
            const rnd_count_porkchop = ((Math.random() * 2) | 0) + 1;

            let drop_item = { pos: mob.pos, items: [] };
            drop_item.items.push({ id: BLOCK.PORKCHOP.id, count: rnd_count_porkchop });

            actions.addDropItem(drop_item);

            actions.addPlaySound({ tag: 'madcraft:block.pig', action: 'death', pos: mob.pos.clone() });

            world.actions_queue.add(actor, actions);
        }
    }
*/
}