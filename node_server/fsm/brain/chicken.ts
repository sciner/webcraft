import { FSMBrain } from "../brain.js";
import { WorldAction } from "@client/world_action.js";
import { EnumDamage } from "@client/enums/enum_damage.js";
import { BLOCK_ACTION } from "@client/server_client.js";
import {MobControlParams, MOB_CONTROL} from "@client/control/player_control.js";

const TIME_IN_NEST = 12000;
const LAY_INTERVAL = 100000;
const COUNT_EGGS_IN_NEST = 8;

export class Brain extends FSMBrain {
    egg_timer: number;
    nest_timer: number;
    nest: any;

    constructor(mob) {
        super(mob);
        this.stack.pushState(this.doStand);
        this.egg_timer = performance.now();
        this.nest_timer = 0;
        this.nest = null;   // гнездо
        const bm = mob.getWorld().block_manager
        this.targets = [
            bm.WHEAT_SEEDS.id,
            bm.MELON_SEEDS.id,
            bm.PUMPKIN_SEEDS.id,
            bm.BEETROOT_SEEDS.id
        ];
    }

    // если нашли гнездо
    doForward(delta: float): MobControlParams | null {
        let result = super.doForward(delta)
        if ((performance.now() - this.egg_timer) > LAY_INTERVAL) {
            const mob = this.mob;
            const world = mob.getWorld();
            const bm = world.block_manager
            if (this.legs.id == bm.CHICKEN_NEST.id && this.legs.extra_data.eggs < COUNT_EGGS_IN_NEST) {
                this.egg_timer = performance.now();
                this.nest_timer = performance.now();
                this.nest = this.legs;
                this.stack.replaceState(this.doLay);
                result = MOB_CONTROL.DO_NOTHING // если несем яйцо, надо остановиться
            }
        }
        return result
    }

    // Процесс сноса яйца
    doLay(delta: float): MobControlParams | null {
        if (!this.nest || this.nest.extra_data.eggs >= COUNT_EGGS_IN_NEST) {
            this.stack.replaceState(this.doForward);
            return MOB_CONTROL.NO_CHANGE
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
                        id: world.block_manager.CHICKEN_NEST.id,
                        extra_data: {
                            eggs: this.nest.extra_data.eggs + 1
                        }
                    },
                    action_id: BLOCK_ACTION.MODIFY
                }]);
                world.actions_queue.add(null, actions);
                this.stack.replaceState(this.doForward);
            }
            return MOB_CONTROL.NO_CHANGE
        }

        mob.rotate.z = this.angleTo(nest_pos);

        return {
            forward: true,
            jump: false,
            sneak: true
        }
    }

    onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        const bm = world.block_manager
        const items = [];
        const actions = new WorldAction();
        items.push({ id: type_damage != EnumDamage.FIRE ? bm.CHICKEN.id : bm.COOKED_CHICKEN.id, count: 1 });
        const rnd_count_feather = (Math.random() * 2) | 0;
        if (rnd_count_feather > 0) {
            items.push({ id: bm.FEATHER.id, count: rnd_count_feather });
        }
        actions.addDropItem({ pos: mob.pos, items: items, force: true });
        actions.addPlaySound({ tag: 'madcraft:block.chicken', action: 'death', pos: mob.pos.clone() });
        world.actions_queue.add(actor, actions);
    }

}