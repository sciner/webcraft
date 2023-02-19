import { FSMBrain } from "../brain.js";
import { Vector } from "../../../www/src/helpers.js";
import { WorldAction } from "../../../www/src/world_action.js";
import { EnumDamage } from "../../../www/src/enums/enum_damage.js";
import { ServerClient } from "../../../www/src/server_client.js";
import { EnumDifficulty } from "../../../www/src/enums/enum_difficulty.js";

const FOLLOW_DISTANCE       = 10;
const DISTANCE_LOST_TRAGET  = 16;
const DISTANCE_DETONATION   = 3;
const DETONATION_TIMER      = 1500; //ms
const EXPLODE_DEFAULT_RAD   = 3;

export class Brain extends FSMBrain {
    detonationTime: number;
    explosion_damage: number;
    players_damage_distance: number;
    is_well: boolean;

    constructor(mob) {
        super(mob);
        //
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 1/2,
            playerHeight: 1.6,
            stepHeight: 1,
            playerHalfWidth: .45
        });
        this.health = 20; // максимальное здоровье
        this.distance_view = 40; // дистанция на которм виден игрок
        mob.extra_data.play_death_animation = false;
        this.detonationTime = 0;
        this.explosion_damage = 12;
        this.players_damage_distance = DISTANCE_DETONATION;        
        this.stack.pushState(this.doStand);
    }

    // поиск игрока для атаки
    onFind() {
        if (this.target || this.distance_view < 1) {
            return;
        }
        const mob = this.mob;
        const world = mob.getWorld();
        const difficulty = world.rules.getValue('difficulty'); 
        const players = world.getPlayersNear(mob.pos, this.distance_view, true);
        if (players.length > 0 && difficulty != EnumDifficulty.PEACEFUL) {
            const rnd = (Math.random() * players.length) | 0;
            const player = players[rnd];
            this.target = player;
        }
    }

    onPanic() {

    }
    
    // Chasing a player
    doCatch(delta : float) {
        const mob = this.mob;
        const world = mob.getWorld();
        const difficulty = world.rules.getValue('difficulty');
        if (!this.target || difficulty == EnumDifficulty.PEACEFUL) {
            this.lostTarget();
            return;
        }
        const dist = mob.pos.distance(this.target.state.pos);
        if (mob.playerCanBeAtacked(this.target) || dist > this.distance_view) {
            this.lostTarget();
            return;
        }
        if (dist < DISTANCE_DETONATION && !this.is_gate) {
            this.detonationTime = performance.now();
            mob.extra_data.detonation_started = true;
            const actions = new WorldAction();
            actions.addPlaySound({ tag: 'madcraft:block.player', action: 'fuse', pos: new Vector(mob.pos) });
            world.actions_queue.add(null, actions);
            this.stack.replaceState(this.doTimerDetonation);
            return;
        }
        mob.rotate.z = this.angleTo(this.target.state.pos);
        this.updateControl({
            yaw: mob.rotate.z,
            forward: !(this.is_abyss || this.is_well),
            jump: this.is_water
        });
        this.applyControl(delta);
        this.sendState();
    }

    lostTarget() {
        const mob = this.mob;
        mob.extra_data.detonation_started = false;
        this.target = null;
        this.stack.replaceState(this.doStand);
    }

    //
    doTimerDetonation(delta) {
        const mob = this.mob;
        const world = mob.getWorld();
        const difficulty = world.rules.getValue('difficulty');
        if (!this.target || difficulty == EnumDifficulty.PEACEFUL) {
            this.lostTarget();
            return;
        }
        const dist = mob.pos.distance(this.target.state.pos);
        // если игрока нет, он умер или сменил игровой режим на безопасный, то теряем к нему интерес
        if (mob.playerCanBeAtacked(this.target) || dist > this.distance_view) {
            this.lostTarget();
            return;
        }
        if (dist < DISTANCE_DETONATION) {
            const time = performance.now() - this.detonationTime;
            if (time > DETONATION_TIMER) {
                this.mobDetonation(EXPLODE_DEFAULT_RAD);
            }
        } else {
            mob.extra_data.detonation_started = false;
            this.stack.replaceState(this.doCatch);
            return;
        }
        mob.rotate.z = this.angleTo(this.target.state.pos);
        this.updateControl({
            yaw: mob.rotate.z,
            forward: false,
            jump: false
        });
        this.applyControl(delta);
        this.sendState();
    }

    //
    mobDetonation(rad) {
        const mob = this.mob;
        const world = mob.getWorld();
        const mobPos = mob.pos.clone();
        const difficulty = world.rules.getValue('difficulty');
        const mobPosCenter = mobPos.addScalarSelf(mob.width / 2, mob.height / 2, mob.width / 2);
        // Actions
        const actions = new WorldAction(null, world, true, false);
        // Extrude blocks
        actions.makeExplosion(mobPosCenter, rad, true, 1/3, 4);
        // Kill mob
        mob.kill();
        // Add sound
        actions.addPlaySound({ tag: 'madcraft:block.creeper', action: 'explode', pos: mobPosCenter.clone() });
        // Custom packets for every player near
        const custom_packets = {
            user_ids: [],
            list: [{
                name: ServerClient.CMD_PLAY_SOUND,
                data: { tag: 'madcraft:block.player', action: 'hit', pos: mobPosCenter.clone() }
            }]
        };
        let damage = 0;
        switch(difficulty) {
            case EnumDifficulty.EASY: damage = 25; break;
            case EnumDifficulty.NORMAL: damage = 49; break;
            case EnumDifficulty.HARD: damage = 73; break;
        }
        const players = world.getPlayersNear(mobPos, this.players_damage_distance, true);
        for(let i = 0; i < players.length; i++) {
            const player = players[i];
            player.setDamage(damage, EnumDamage.EXPLOSION);
            // play hit sound for this player
            custom_packets.user_ids.push(player.session.user_id);
        }
        //
        if(custom_packets.list.length > 0) {
            world.sendSelected(custom_packets.list, custom_packets.user_ids)
        }
        //
        world.actions_queue.add(null, actions);
    }
    
    onKill(actor, type_damage) {
        const mob = this.mob;
        const world = mob.getWorld();
        const rnd_count_flesh = (Math.random() * 2) | 0;
        if (rnd_count_flesh > 0) {
            const actions = new WorldAction();
            const drop_block = world.block_manager.fromName('GUNPOWDER');
            actions.addDropItem({ pos: mob.pos, items: [{ id: drop_block.id, count: rnd_count_flesh }] });
            actions.addPlaySound({ tag: 'madcraft:block.creeper', action: 'death', pos: mob.pos.clone() });
            world.actions_queue.add(actor, actions);
        }
    }

}