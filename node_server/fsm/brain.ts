import { FSMStack } from "./stack.js";
import {PrismarinePlayerControl} from "@client/prismarine-physics/using.js";
import {Helpers, Mth, Vector} from "@client/helpers.js";
import { ServerClient } from "@client/server_client.js";
import type { Mob } from "../mob.js";
import { EnumDamage } from "@client/enums/enum_damage.js";
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "@client/fluid/FluidConst.js";
import { WorldAction } from "@client/world_action.js";
import {MobControlParams, MOB_CONTROL} from "@client/control/player_control.js";
import type {World} from "@client/world.js";
import type {ServerWorld} from "../server_world.js";
import type { ServerChunk } from "server_chunk.js";
import {EnumDifficulty} from "@client/enums/enum_difficulty.js";
import {Effect} from "@client/block_type/effect.js";

const MUL_1_SEC = 20;

export class FSMBrain {

    #pos;
    world: ServerWorld
    prevPos: Vector;
    lerpPos: Vector;
    mob: Mob;
    stack: FSMStack;
    enabled = true // true если моб контролирует себя (а не кто-то контролирует его в вождении). Только вождение может менять это поле!
    _eye_pos: Vector;
    timer_health: number;
    timer_panic: number;
    timer_fire_damage: number;
    timer_lava_damage: number;
    timer_water_damage: number;
    time_fire: number;
    target: any;
    to: any;
    resistance_light: boolean;
    pc: PrismarinePlayerControl;
    under: any;
    legs: any;
    in_water: boolean;
    in_fire: boolean;
    in_lava: boolean;
    in_air: boolean;
    is_wall: boolean;
    targets: any;
    ahead: any
    timer_attack = 0

    constructor(mob: Mob) {
        this.mob = mob;
        this.stack = new FSMStack();
        this.world = mob.getWorld()
        this.#pos = new Vector(0, 0, 0);
        this._eye_pos = new Vector(0, 0, 0);
        this.prevPos    = new Vector(mob.pos);
        this.lerpPos    = new Vector(mob.pos);
        this.pc = new PrismarinePlayerControl(this.world as any as World, mob.pos, mob.config.physics)
        // таймеры
        this.timer_health = 0;
        this.timer_panic = 0;
        this.timer_fire_damage = 0;
        this.timer_lava_damage = 0;
        this.timer_water_damage = 0;
        this.time_fire = 0;
        // цель
        this.target = null;
        this.to = null;
        // защита
        this.resistance_light = true;
    }

    addStat(name : string, allowAdding : boolean = false) {
        const mobs = this.mob.getWorld().mobs
        mobs.getTickStatForMob(this.mob).add(name, allowAdding)
        mobs.ticks_stat.add(name, allowAdding)
    }

    tick(delta : float) {
        const chunk = this.mob.inChunk
        if (!chunk?.isReady()) {
            return
        }
        this.onLive();
        if (!this.enabled) {
            return
        }

        const stateFunctionUsed = this.stack.getCurrentState()
        if (stateFunctionUsed) {
            // мозг думает
            const updateChange = this.stack.tick(delta, this)
            this.addStat(stateFunctionUsed.func.name, true)
            // выполнить физику, выслать состояние
            if (updateChange) {
                this.applyControl(delta, updateChange)
                this.addStat('physics')
                this.sendState()
            }
        }

        const driving = this.mob.driving
        if (driving) {
            // есть вождение, но моб сам им управляет. Обновить состояние вождения.
            driving.updateFromVehicle(this.mob)
            driving.applyToDependentParticipants(false)
        }
    }

    // Send current mob state to players
    sendState() {
        const mob = this.mob;
        const world = mob.getWorld();
        const chunk_over = mob.inChunk
        if (!chunk_over) {
            return;
        }
        const new_state = mob.exportState(true)
        // if state not changed
        if(!new_state) {
            return
        }
        const packets = [{
            name: ServerClient.CMD_MOB_UPDATE,
            data: new_state
        }];
        world.packets_queue.add(chunk_over.connections.keys(), packets);
    }

    /** Устанавливает новые параметры управления для {@link pc} и выполняет физику, если нужно */
    applyControl(delta: float, new_states: MobControlParams): void {
        this.pc.updateControlsFromMob(new_states, this.mob.rotate.z)
        if (this.enabled) {
            this.pc.tick(delta)
            this.mob.updateStateFromControl()
        }
    }

    // угол между таргетом и мобом
    angleTo(target : Vector) {
        return Helpers.angleTo(this.mob.pos, target)
    }

    /**
     * На этом месте можно стоять?
     */
    isStandAt(position: Vector): boolean {
        const pos = position.floored();
        const world = this.mob.getWorld()
        let block = world.getBlock(pos);
        const AIR = world.block_manager.AIR
        if (block && ((block.id == AIR.id && block.fluid == 0) || (block.material.style_name == 'planting'))) {
            block = world.getBlock(pos.offset(0, -1, 0));
            if (block && block.id != AIR.id) {
                block = world.getBlock(pos.offset(0, 1, 0));
                if (block && ((block.id == AIR.id && block.fluid == 0) || (block.material.style_name == 'planting'))) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Returns the position of the eyes of the mob
     */
    getEyePos() : Vector {
        const mob = this.mob;
        const subY = 0;
        //if(this.state.sitting) {
        //    subY = this.pc.physics.playerHeight * 1/3;
        //}
        return this._eye_pos.set(mob.pos.x, mob.pos.y + this.height * 0.85 - subY, mob.pos.z);
    }

    get height(): float {
        return this.pc.playerHeight
    }

    get distance_view(): int { return this.mob.config.distance_view }

    // контроль жизней и состояния моба
    onLive() {
        const mob = this.mob;
        const mob_chunk = mob.inChunk
        if (!mob_chunk) {
            return
        }
        const world = mob.getWorld()
        // адреса

        const config = mob.config

        const bm = world.block_manager
        const state = this.pc.player_state
        // @todo старый вариант
        //const forward = mob.pos.add(mob.forward).floored();
       // const ahead = chunk.getBlock(forward.offset(0, 1, 0).floored());
        //const alegs = chunk.getBlock(forward);
        //const under = chunk.getBlock(forward.offset(0, -1, 0));
        //const abyss = chunk.getBlock(forward.offset(0, -2, 0));
        //this.is_abyss = under.id == 0 && under.fluid == 0 && abyss.id == 0 && abyss.fluid == 0 && alegs.id == 0 && alegs.fluid == 0;
       // this.is_fire = (alegs.id == bm.FIRE.id || alegs.id == bm.CAMPFIRE.id);
        //this.is_water = ((under.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID)
       // this.is_lava = ((under.fluid & FLUID_TYPE_MASK) === FLUID_LAVA_ID);
         //this.under_id = under.id;

        const mob_pos = mob.pos.floored()
        const head = mob_chunk.getBlock(this.getEyePos().floored())
        this.legs = mob_chunk.getBlock(mob_pos)
        this.in_water = (head.id == 0 && (head.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID) && state.isInWater
        this.in_fire = (this.legs.id == bm.FIRE.id || this.legs.id == bm.CAMPFIRE.id)
        this.in_lava = state.isInLava
        this.in_air = (head.fluid == 0 && (this.legs.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID)

        this.ahead = {
            is_water: false,
            is_abyss: false,
            is_lava: false,
            is_fire: false
        }
        this.under = null
        // коллизия со стеной
        this.is_wall = state.isCollidedHorizontally
        //


        if (!this.is_wall) {
            const forward = mob.pos.clone()
            forward.addSelf(mob.forward.mulScalar(this.pc.playerHalfWidth)).floored()
            let height = 0
            let chunk : ServerChunk = null
            const _chunk_addr = new Vector()
            const grid = world.chunkManager.grid
            for (let i = 0; i < 5; i++) {
                grid.getChunkAddr(forward.x, forward.y, forward.z, _chunk_addr)
                if(!chunk || !chunk.addr.equal(_chunk_addr)) {
                    chunk = world.chunkManager.getChunk(_chunk_addr)
                }
                if(!chunk) {
                    continue
                }
                const block = chunk.getBlock(forward)
                if (i == 0) {
                    this.under = block
                }
                forward.y--
                if (block.id == 0) {
                    if ((block.fluid & FLUID_TYPE_MASK) === FLUID_WATER_ID) {
                        this.ahead.is_water = true
                        break
                    } else if ((block.fluid & FLUID_TYPE_MASK) === FLUID_LAVA_ID) {
                        this.ahead.is_lava = true
                        break
                    } else {
                        height++
                    }
                } else if (block.id == bm.FIRE.id || block.id == bm.CAMPFIRE.id) {
                    this.ahead.is_fire = true
                    break
                } else {
                    break
                }
            }
            if (height > 3) {
                this.ahead.is_abyss = true
            }

        }

        // стоит в лаве
        if (this.in_lava) {
            if (this.timer_lava_damage <= 0) {
                this.timer_lava_damage = MUL_1_SEC;
                this.onDamage(2, EnumDamage.LAVA, null, null);
            } else {
                this.timer_lava_damage--;
            }
            this.time_fire = Math.max(10 * MUL_1_SEC, this.time_fire);
        } else {
            this.timer_lava_damage = 0;
        }
        // стоит в огне или на свете
        if (this.in_fire || (world.getLight() > 11
            && (mob_chunk.tblocks.lightData && (this.legs.lightValue >> 8) === 0)
            && !this.resistance_light)) {
            this.time_fire = Math.max(8 * MUL_1_SEC, this.time_fire);
        }
        // нехватка воздуха
        if (this.in_water && config.can_asphyxiate) {
            if (this.timer_water_damage >= MUL_1_SEC) {
                this.timer_water_damage = 0;
                this.onDamage(1, EnumDamage.WATER, null, null);
            } else {
                this.timer_water_damage++;
            }
        } else {
            this.timer_water_damage = 0;
        }
        // тушение в воде
        if (state.isInWater) {
            this.time_fire = 0
        }
        // горение
        if (this.time_fire > 0) {
            this.time_fire--
            if (this.timer_fire_damage >= MUL_1_SEC) {
                this.timer_fire_damage = 0;
                this.onDamage(1, EnumDamage.FIRE, null, null);
            } else {
                this.timer_fire_damage++;
            }
        }
        // регенерация жизни
        if (this.timer_health >= 10 * MUL_1_SEC) {
            mob.indicators.live = Math.min(mob.indicators.live + 1, this.mob.config.health);
            this.timer_health = 0;
        } else {
            this.timer_health++;
        }
        // паника
        if (this.timer_panic > 0) {
            this.timer_panic--;
        }

        // update extra data
        this.mob.extra_data.in_fire = this.time_fire > 0;

        this.addStat('onLive')
        this.onFind()
    }

    // поиск игроков или мобов
    onFind() {
        if (this.target || !this.targets || this.targets.length == 0 || this.distance_view < 1) {
            return
        }
        // это медленная функция, но ее можно выполнять раз в несколько секунд
        if ((this.world.ticks_stat.number + this.mob.id) % 30 !== 0) {
            return
        }
        const mob = this.mob;
        const world = mob.getWorld();
        const players = world.getPlayersNear(mob.pos, this.distance_view, false);
        for (const player of players) {
            if (Math.random() > (player.state.pos.distance(mob.pos) / this.distance_view) && this.targets.includes(player.state.hands.right.id)) {
                this.target = player
                break
            }
        }
        this.addStat('onFind');
    }

    // идти за игроком, если в руках нужный предмет
    doCatch(delta: float): MobControlParams | null {
        const mob = this.mob
        this.timer_panic = 0;
        if (!this.target || this.distance_view < 1) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return MOB_CONTROL.STAND
        }
        const dist = mob.pos.distance(this.target.state.pos);
        if (this.target.game_mode.isSpectator() || dist > this.distance_view || !this.targets.includes(this.target.state.hands.right.id)) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return MOB_CONTROL.STAND
        }
        mob.rotate.z = this.angleTo(this.target.state.pos);
        const forward = dist > 1.5 && !this.is_wall && !this.ahead.is_abyss
        return {
            forward,
            jump: this.in_water,
            sneak: false
        }
    }

    /** Атака - одинаковый код для скелета и моба */
    doAttack(delta: float): MobControlParams | null {
        const mob = this.mob;
        const attack = mob.config.attack
        if (!attack) {
            console.error('doAttack as no attack config')
            this.stack.replaceState(this.doStand)
            return MOB_CONTROL.STAND
        }
        const world = mob.getWorld();
        const difficulty = world.rules.getValue('difficulty');
        if (!this.target || difficulty == EnumDifficulty.PEACEFUL) {
            this.target = null;
            this.stack.replaceState(this.doStand);
            return MOB_CONTROL.STAND
        }
        const dist = mob.pos.distance(this.target.state.pos);
        if (mob.playerCanBeAtacked(this.target) || dist > attack.distance || this.is_wall) {
            this.stack.replaceState(this.doCatch);
            return MOB_CONTROL.NO_CHANGE
        }
        const angle_to_player = this.angleTo(this.target.state.pos);
        // моб должен примерно быть направлен на игрока
        if (Mth.radians_to_minus_PI_PI_range(mob.rotate.z - angle_to_player) > Mth.PI_DIV2) {
            // сперва нужно к нему повернуться
            this.mob.rotate.z = angle_to_player;
        } else if (++this.timer_attack > attack.interval) {
            mob.extra_data.attack = {title: 'attack', speed: 1}
            this.attack(difficulty)
        }
        return MOB_CONTROL.STAND
    }

    /** Стоит на месте, но иногда начинает идти; реагирует на разные ситуации. См. также {@link doNothing} */
    doStand(delta : float): MobControlParams | null {
        // нашел цель
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return MOB_CONTROL.STAND
        }
        if (this.in_water) { // попал в воду
            this.stack.replaceState(this.doFindGround);
            return MOB_CONTROL.STAND
        }
        if (Math.random() < .05 || this.timer_panic > 0) {
            this.stack.replaceState(this.doForward);
        }
        return MOB_CONTROL.STAND
    }

    /** Не делает ниего, ни при каких обстоятелствах. Для неодушевленных объектов типа лодки. См. также {@link doStand} */
    doNothing(delta: float): MobControlParams | null {
        return MOB_CONTROL.DO_NOTHING
    }

    // просто ходит
    doForward(delta: float): MobControlParams | null {
        const mob = this.mob;
        // нашел цель
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return MOB_CONTROL.NO_CHANGE
        }
        // попал в воду
        if (this.in_water) {
            this.stack.replaceState(this.doFindGround);
            return MOB_CONTROL.NO_CHANGE
        }
        // обход препятсвия
        if (this.is_wall || this.ahead.is_fire || this.ahead.is_lava || (this.ahead.is_water && this.time_fire == 0) || this.ahead.is_abyss) {
            mob.rotate.z = mob.rotate.z + (Math.PI / 2) + (Math.random() - Math.random()) * Math.PI / 8;
            this.stack.replaceState(this.doStand);
            return MOB_CONTROL.STAND
        }
        if (Math.random() < 0.05) {
            mob.rotate.z = mob.rotate.z + (Math.random() - Math.random()) * Math.PI / 12;
            this.stack.replaceState(this.doStand);
            return MOB_CONTROL.STAND
        }
        return {
            forward: true,
            jump: false,
            sneak: false,
            pitch: this.timer_panic > 0
        }
    }

    // поиск суши
    doFindGround(delta: float): MobControlParams | null {
        const mob = this.mob;
        // нашел цель
        if (this.target) {
            this.stack.replaceState(this.doCatch);
            return MOB_CONTROL.NO_CHANGE
        }
        // находим пересечение сред
        if (this.in_air) {
            const angle_random = mob.rotate.z + (Math.random() - Math.random()) * Math.PI / 8;
            const ray = this.world.raycaster.get(mob.pos,
                new Vector(Math.sin(angle_random), 0, Math.cos(angle_random)),
                32, null, false, false, this.mob
            )
            if (ray) {
               const to = new Vector(ray.x, ray.y + 1, ray.z);
               if (!this.to || (this.isStandAt(to) && mob.pos.distance(to) < mob.pos.distance(this.to))) {
                   this.to = to;
               }
            }
            if (!this.to || !this.isStandAt(this.to)) {
                this.to = null;
                mob.rotate.z += (Math.random()  * Math.PI / 12);
            }
        }

        if (this.to) {
            const dist = mob.pos.horizontalDistance(this.to)
            mob.rotate.z = this.angleTo(this.to)
            if (dist < 0.5) {
                this.stack.replaceState(this.doStand);
                return MOB_CONTROL.STAND
            }
        }
        return {
            forward: this.to ? true : false,
            jump: this.pc.player_state.isInWater,
            sneak: false
        }
    }

    /**
    * Нанесен урон по мобу
    * val - количество урона
    * type_damage - от чего умер[упал, сгорел, утонул]
    * actor - игрок или пероснаж
    */
    onDamage(val : number, type_damage : EnumDamage, actor, pos: Vector) {
        const mob = this.mob;
        const world = mob.getWorld();
        if (pos && mob.config.damagePushes && this.enabled) {
            const velocity = mob.pos.clone()
            velocity.subSelf(pos).normSelf().mulScalarSelf(.75)
            velocity.y = .2
            mob.addVelocity(velocity)
        }
        mob.indicators.live -= val
        mob.extra_data.health = Math.round(mob.indicators.live * 100 / mob.config.health)
        this.sendState()
        if (mob.indicators.live <= 0) {
            mob.kill();
            this.onKill(actor, type_damage);
        } else {
            const actions = new WorldAction();
            const mob_type = mob.skin.model_name.split('/')[1]
            actions.addPlaySound({ tag: 'madcraft:block.' + mob_type, action: 'hurt', pos: mob.pos.clone() });
            world.actions_queue.add(actor, actions);
            this.onPanic();
            mob.markDirty();
        }
    }

    // паника моба от урона
    onPanic() {
        const mob = this.mob;
        this.timer_panic = mob.config.timer_panic ?? 80;
        if (this.timer_panic && this.enabled) {
            this.target = null;
            mob.rotate.z = 2 * Math.random() * Math.PI;
            this.stack.replaceState(this.doStand);
        }
    }

    /**
    * Моба убили
    * actor - игрок или пероснаж
    * type_damage - от чего умер[упал, сгорел, утонул]
    */
    onKill(actor, type_damage) {
    }

    /**
     * Использовать предмет на мобе
     * @param actor игрок
     * @param item item
     */
    onUse(actor : any, item : any) : boolean {
        return false;
    }

    addVelocity(vec : Vector) {
        this.pc.player_state.vel.addSelf(vec)
        this.pc.tick(0)
    }

    /** Атакует цель - наносит урон, проигрывает звук, и т.п. */
    protected attack(difficulty: number): void {
        const player = this.target
        const attack = this.mob.config.attack
        this.timer_attack = 0
        let damage: [int, int]
        let effect: any
        switch(difficulty) {
            case EnumDifficulty.EASY:
                damage = attack.damage_easy
                effect = attack.effect_easy
                break
            case EnumDifficulty.NORMAL:
                damage = attack.damage_normal
                effect = attack.effect_normal
                break
            case EnumDifficulty.HARD:
                damage = attack.damage_hard
                effect = attack.effect_hard
                break
        }
        player.setDamage(Mth.randomIntRange(damage[0], damage[1]))
        if (effect) {
            player.effects.addEffects({...effect})
        }
        if (attack.sound) {
            const actions = new WorldAction()
            actions.addPlaySound({...attack.sound, pos: this.mob.pos.clone() }) // Звук получения урона
            this.world.actions_queue.add(this.mob, actions)
        }
    }

}