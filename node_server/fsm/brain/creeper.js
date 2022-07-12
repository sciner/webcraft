import { FSMBrain } from "../brain.js";
import { Vector } from "../../../www/js/helpers.js";
import { PickatActions } from "../../../www/js/block_action.js";
import {ServerClient} from "../../../www/js/server_client.js";

const FOLLOW_DISTANCE       = 10;
const DISTANCE_LOST_TRAGET  = 16;
const DISTANCE_DETONATION   = 3;
const DETONATION_TIMER      = 1500; //ms
const EXPLODE_DEFAULT_RAD   = 2.7;

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 1/2,
            playerHeight: 1.6,
            stepHeight: 1
        });
        mob.extra_data.play_death_animation = false;

        this.detonationTime = 0;
        this.explosion_damage = 12;
        this.players_damage_distance = DISTANCE_DETONATION;

        this.widtn = 0.6;
        this.height = 1.2;
        
        this.stack.pushState(this.doStand);
    }

    findTarget() {
        if (this.target == null) {
            const mob = this.mob;
            const players = this.getPlayersNear(mob.pos, FOLLOW_DISTANCE, true);
            if (players.length > 0) {
                const rnd = (Math.random() * players.length) | 0;
                const player = players[rnd];
                this.target = player.session.user_id;
                this.stack.replaceState(this.doCatch);
                return true;
            }
        }
        return false;
    }

    onPanic() {

    }
    
    // Chasing a player
    async doCatch(delta) {
        const mob = this.mob;
        const player = mob.getWorld().players.get(this.target);
        const dist = mob.pos.distance(player.state.pos);
        if (mob.playerCanBeAtacked(player) || dist > DISTANCE_LOST_TRAGET) {
            return this.lostTarget();
        }

        const block = this.getBeforeBlocks();
        mob.rotate.z = this.angleTo(player.state.pos);
        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: true,
            jump: block.body.material.is_fluid
        });
        this.applyControl(delta);
        this.sendState();

        if (dist < DISTANCE_DETONATION) {
            this.detonationTime = performance.now();
            mob.extra_data.detonation_started = true;
            mob.getWorld().actions_queue.add(null, {
                play_sound: [
                    { tag: 'madcraft:block.player', action: 'fuse', pos: new Vector(mob.pos) }
                ]
            });
            this.stack.replaceState(this.doTimerDetonation);
        }
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
        const player = mob.getWorld().players.get(this.target);
        mob.rotate.z = this.angleTo(player.state.pos);

        this.updateControl({
            yaw: this.mob.rotate.z,
            forward: false,
            jump: false
        });
        this.applyControl(delta);
        this.sendState();
        
        // если игрока нет, он умер или сменил игровой режим на безопасный, то теряем к нему интерес
        if (mob.playerCanBeAtacked(player)) {
            return this.lostTarget();
        }

        const dist = mob.pos.distance(player.state.pos);
        if (dist < DISTANCE_DETONATION) {
            const time = performance.now() - this.detonationTime;
            if (time > DETONATION_TIMER) {
                this.mobDetonation(EXPLODE_DEFAULT_RAD);
            }
        } else {
            mob.extra_data.detonation_started = false;
            this.stack.replaceState(this.doCatch);
        }
    }

    //
    async mobDetonation(rad) {
        const mob = this.mob;
        const world = mob.getWorld();
        const mobPos = mob.pos.clone();
        const mobPosCenter = mobPos.addScalarSelf(mob.width / 2, mob.height / 2, mob.width / 2);
        // Actions
        const actions = new PickatActions(null, world, true, false);
        // Extrude blocks
        actions.makeExplosion(mobPosCenter, rad, true, 1/3, 6);
        // Kill mob
        await mob.kill();
        // Add sound
        actions.addPlaySound({ tag: 'madcraft:block.creeper', action: 'explode', pos: mobPosCenter.clone() });
        // Custom packets for every player near
        const custom_packets = {
            user_ids: [],
            list: [{
                name: ServerClient.CMD_PLAY_SOUND,
                data: { tag: 'madcraft:block.player', action: 'hit', pos: null}
            }]
        };
        const players = this.getPlayersNear(mobPos, this.players_damage_distance, true);
        for(let i = 0; i < players.length; i++) {
            const player = players[i];
            player.changeLive(-this.explosion_damage);
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
        if (actor != null) {
            const rnd_count_flesh = (Math.random() * 2) | 0;
            if (rnd_count_flesh > 0) {
                const actions = new PickatActions();

                const drop_block = world.block_manager.fromName('GUNPOWDER');
                actions.addDropItem({ pos: mob.pos, items: [{ id: drop_block.id, count: rnd_count_flesh }] });

                actions.addPlaySound({ tag: 'madcraft:block.creeper', action: 'death', pos: mob.pos.clone() });

                world.actions_queue.add(actor, actions);
            }
        }
    }

}