"use strict";

import { KEY, SPECTATOR_SPEED_MUL } from "../constant.js";
import { Vector } from "../helpers.js";

export class PlayerControl  {
    [key: string]: any;

    constructor(options) {
        this.mouseX             = 0;
        this.mouseY             = 0;
        this.mouse_sensitivity  = (options.mouse_sensitivity ?? 100.0) / 100;
        this.inited             = false;
        this.enabled            = false;
        this.reset();
    }

    // reset controls
    reset() {
        this.setState(false, false, false, false, false, false, false);
    }

    setState(forward, back, left, right, jump, sneak, sprint) {
        this.forward            = forward;
        this.back               = back;
        this.left               = left;
        this.right              = right;
        this.jump               = jump;
        this.sneak              = sneak;
        this.sprint             = sprint;
    }

}

export class OldSpectatorPlayerControl {
    [key: string]: any;

    constructor(world, start_position) {
        this.world              = world;
        this.timeAccumulator    = 0;
        this.physicsEnabled     = true;
        this.keys               = {};
        //
        this.physics            = {}
        //
        this.player             = {
            entity: {
                position: new Vector(start_position)
            }
        }
        //
        this.controls = {
            forward: false,
            back: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
            sneak: false
        };
        //
        this.player_state = {
            yaw: 0,
            vel: new Vector(0, 0, 0),
            pos: new Vector(0, 0, 0),
            onGround: true,
            flying: true,
            isInWater: false
        }
    }

    // Tick
    tick(delta, scale) {
        if(this.controls.forward) {
            if(!this.keys[KEY.W]) this.keys[KEY.W] = performance.now();
        } else {
            this.keys[KEY.W] = false;
        }
        //
        if(this.controls.back) {
            if(!this.keys[KEY.S]) this.keys[KEY.S] = performance.now();
        } else {
            this.keys[KEY.S] = false;
        }
        //
        if(this.controls.left) {
            if(!this.keys[KEY.A]) this.keys[KEY.A] = performance.now();
        } else {
            this.keys[KEY.A] = false;
        }
        //
        if(this.controls.right) {
            if(!this.keys[KEY.D]) this.keys[KEY.D] = performance.now();
        } else {
            this.keys[KEY.D] = false;
        }
        //
        let velocity  = this.player_state.vel;
        // Flying
        if(this.controls.jump) {
            velocity.y = 8 * scale;
        } else {
            velocity.y += -(15 * delta) * scale;
            if(velocity.y < 0) velocity.y = 0;
        }
        if(this.controls.sneak) velocity.y = -8 * scale;
        // Calculate new velocity
        let add_force = this.calcForce();
        let y = delta/(1/(60/(delta/(1/60))));
        let p = this.player_state.flying ? .97 : .9;
        p = Math.pow(p, y);
        this.player_state.vel = velocity
            .add(add_force.normal())
            .mul(new Vector(p, 1, p));
        //
        let passable = 1;
        const mulx = SPECTATOR_SPEED_MUL * (this.mul ?? 1);
        const mul = ((this.controls.sprint ? this.player_state.flying ? 1.15 : 1.5 : 1) * passable / 2.8) * mulx;
        this.player.entity.position.addScalarSelf(
            this.player_state.vel.x * delta * mul,
            this.player_state.vel.y * delta * (mul * 2),
            this.player_state.vel.z * delta * mul
        );
    }

    //
    calcForce() {
        let calcSpeed = (v) => {
            let passed = performance.now() - v;
            if(!this.player_state.flying) {
                passed = 1000;
            } else if(passed < 500) {
                passed = 500;
            }
            let resp = Math.max(0, Math.min(passed / 1000, 1));
            resp = Math.min(resp, 5);
            return resp;
        };
        let yaw = this.player_state.yaw;
        let add_force = new Vector(0, 0, 0);
        if(this.keys[KEY.W] && !this.keys[KEY.S]) {
            let speed = calcSpeed(this.keys[KEY.W]);
            add_force.x += Math.cos(Math.PI / 2 - yaw) * speed;
            add_force.z += Math.sin(Math.PI / 2 - yaw) * speed;
        }
        if(this.keys[KEY.S] && !this.keys[KEY.W]) {
            let speed = calcSpeed(this.keys[KEY.S]);
            add_force.x += Math.cos(Math.PI + Math.PI / 2 - yaw) * speed;
            add_force.z += Math.sin(Math.PI + Math.PI / 2 - yaw) * speed;
        }
        if(this.keys[KEY.A] && !this.keys[KEY.D]) {
            let speed = calcSpeed(this.keys[KEY.A]);
            add_force.x += Math.cos(Math.PI / 2 + Math.PI / 2 - yaw) * speed;
            add_force.z += Math.sin(Math.PI / 2 + Math.PI / 2 - yaw) * speed;
        }
        if(this.keys[KEY.D] && !this.keys[KEY.A]) {
            let speed = calcSpeed(this.keys[KEY.D]);
            add_force.x += Math.cos(-Math.PI / 2 + Math.PI / 2 - yaw) * speed;
            add_force.z += Math.sin(-Math.PI / 2 + Math.PI / 2 - yaw) * speed;
        }
        return add_force;
    }

}