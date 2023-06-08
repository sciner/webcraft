import { FSMBrain } from "../brain.js";
import { WorldAction } from "@client/world_action.js";
import { EnumDamage } from "@client/enums/enum_damage.js";
import { BLOCK_ACTION } from "@client/server_client.js";
import {MobControlParams, MOB_CONTROL} from "@client/control/player_control.js";

export class Brain extends FSMBrain {
    count_grass: number;

    constructor(mob) {
        super(mob);
        this.stack.pushState(this.doStand);
        this.count_grass = 0;  // количество травы
        this.targets = [
            mob.getWorld().block_manager.WHEAT.id
        ];
    }

    get is_sheared() {
        return !!this.mob.extra_data?.is_sheared;
    }

    set is_sheared(value) {
        this.mob.extra_data.is_sheared = value;
    }
    
    // просто стоит и кушает траву, если голодная
    doStand(delta: float): MobControlParams | null {
        const result = super.doStand(delta);
        if (this.is_sheared && Math.random() < 0.8) {
            this.stack.replaceState(this.doEat);
        }
        return result
    }
    
    // ест траву
    doEat(delta: float): MobControlParams | null {
        const mob = this.mob;
        const world = mob.getWorld();
        const bm = world.block_manager
        if (this.count_grass > 5) {
            this.count_grass = 0;
            this.is_sheared = false;
        }
        if (this.is_sheared) {
            if (this.legs.id == bm.TALL_GRASS.id || this.legs.id == bm.GRASS.id) {
                const actions = new WorldAction();
                actions.addBlocks([
                    {
                        pos: mob.pos.floored(), 
                        item: {id : bm.AIR.id}, 
                        action_id: BLOCK_ACTION.REPLACE
                    }
                ]);
                world.actions_queue.add(null, actions); 
                this.count_grass++;
            } else {
                if (this.under && this.under.id == bm.GRASS_BLOCK.id) {
                    const actions = new WorldAction();
                    actions.addBlocks([
                        {
                            pos: this.under.posworld, 
                            item: {id : bm.DIRT.id}, 
                            action_id: BLOCK_ACTION.REPLACE
                        }
                    ]);
                    world.actions_queue.add(null, actions); 
                    this.count_grass++;
                }
            }
        }
        this.stack.replaceState(this.doForward);
        return MOB_CONTROL.STAND
    }
    
    // Если убили моба
    onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        const items = [];
        const actions = new WorldAction();
        const rnd_count_mutton = (Math.random() * 2) | 0;
        const bm = world.block_manager
        items.push({ id: type_damage != EnumDamage.FIRE ? bm.MUTTON.id : bm.COOKED_MUTTON.id, count: rnd_count_mutton + 1 });
        if (!this.is_sheared) {
            const drop_block = world.block_manager.fromName('WHITE_WOOL');
            items.push({ id: drop_block.id, count: 1 });
        }
        actions.addDropItem({ pos: mob.pos, items: items, force: true });
        actions.addPlaySound({ tag: 'madcraft:block.sheep', action: 'death', pos: mob.pos.clone() });
        world.actions_queue.add(actor, actions);
    }
    
    // если использовали предмет
    onUse(actor, id) {
        if (!actor || !id){
            return;
        }
        
        const mob = this.mob;
        const world = mob.getWorld();
        const bm = world.block_manager
        
        if (id == bm.SHEARS.id && !this.is_sheared) {
            this.is_sheared = true;
            const actions = new WorldAction();

            const rnd_count = ((Math.random() * 2) | 0) + 1;
            const drop_block = world.block_manager.fromName('WHITE_WOOL');
            actions.addDropItem({ pos: mob.pos, items: [{ id: drop_block.id, count: rnd_count }] });
            world.actions_queue.add(actor, actions);
            return true;
        }
        return false;
    }
    
}