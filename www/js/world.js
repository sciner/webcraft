import {ChunkManager} from "./chunk_manager.js";
import {Helpers, Vector} from "./helpers.js";
import Particles_Block_Destroy from "./particles/block_destroy.js";
import Particles_Raindrop from "./particles/raindrop.js";
import Particles_Sun from "./particles/sun.js";
import Particles_Clouds from "./particles/clouds.js";
import PlayerModel from "./player_model.js";
import {GameMode} from "./game_mode.js";
import ServerClient from "./server_client.js";
import {MeshManager} from "./mesh_manager.js";

const MAX_DIST_FOR_SHIFT = 800;

// World container
export class World {

    constructor(saved_state) {
        this._savedState = saved_state;
        this.server_state = null;
        this.clouds = null;
        // Autosave
        setInterval(() => {
            console.log('Autosave ... OK');
            Game.saves.save(this);
        }, 60000 * 5);

    }

    async connect() {
        let serverURL = (window.location.protocol == 'https:' ? 'wss:' : 'ws:') +
            '//' + location.hostname +
            (location.port ? ':' + location.port : '') +
            '/ws';
        return new Promise(res => {
            const server = new ServerClient(serverURL, () => {
                res(server);
            });
        });
    }

    async init() {
        const saved_state = this._savedState;
        // Create server client
        this.server = await this.connect();
        this.server.Send({name: ServerClient.EVENT_CONNECT, data: {id: saved_state.id, seed: saved_state.seed + ''}});
        this.players        = [];
        this.rainTim        = null;
        this.saved_state    = saved_state;
        this.seed           = saved_state.seed;
        this.chunkManager   = new ChunkManager(this);
        this.rotateRadians  = new Vector(0, 0, 0);
        this.rotateDegree   = new Vector(0, 0, 0);
        this.meshes         = new MeshManager();
        this.rotate         = new Vector(saved_state.rotate.x, saved_state.rotate.y, saved_state.rotate.z);
        this.spawnPoint     = new Vector(saved_state.spawnPoint.x, saved_state.spawnPoint.y, saved_state.spawnPoint.z);
        if(saved_state.hasOwnProperty('chunk_render_dist')) {
            this.chunkManager.setRenderDist(saved_state.chunk_render_dist);
        }
        // Game mode
        this.game_mode = new GameMode(this, saved_state.game_mode);
    }

    setServerState(server_state) {
        this.server_state = server_state;
        this.server_state_give_time = performance.now();
    }

    //
    getTime() {
        if(!this.server_state) {
            return null;
        }
        let add = (performance.now() - this.server_state_give_time) / 1000 / 1200 * 24000 | 0;
        let time = (this.server_state.day_time + 6000 + add) % 24000 | 0;
        let hours = time / 1000 | 0;
        let minutes = (time - hours * 1000) / 1000 * 60 | 0;
        let minutes_string = minutes > 9 ? minutes : '0' + minutes;
        let hours_string = hours > 9 ? hours : '0' + hours;
        return {
            day:        this.server_state.age,
            hours:      hours,
            minutes:    minutes,
            string:     hours_string + ':' + minutes_string
        };
    }

    // Draw
    draw(render, delta) {
        // Meshes
        this.meshes.draw(render, delta);
        // Clouds
        if(!this.clouds) {
            let pos = new Vector(this.spawnPoint);
            pos.y = 128.1;
            console.log(pos);
            this.clouds = this.createClouds(pos);
        }
        // Picking target
        let player = this.localPlayer;
        if (player && player.pickAt && Game.hud.active && this.game_mode.canBlockAction()) {
            player.pickAt.update();
        }
        return true;
    }

    //
    createClone() {
        this.players['itsme'] = new PlayerModel({
            id:             'itsme',
            itsme:          true,
            angles:         this.localPlayer.angles,
            pos:            new Vector(this.localPlayer.pos.x, this.localPlayer.pos.y, this.localPlayer.pos.z),
            yaw:            this.localPlayer.angles[2],
            pitch:          this.localPlayer.angles[0],
            skin:           Game.skins.getById(Game.skin.id),
            nick:           Game.username
        });
    };

    // setBlock
    setBlock(x, y, z, type, power, rotate, entity_id, extra_data) {
        this.chunkManager.setBlock(x, y, z, type, true, power, rotate, entity_id, extra_data);
    }

    // destroyBlock
    destroyBlock(block, pos, small) {
        this.meshes.add(new Particles_Block_Destroy(this.renderer.gl, block, pos, small));
    }

    // rainDrop
    rainDrop(pos) {
        this.meshes.add(new Particles_Raindrop(this.renderer.gl, pos));
    }

    // createClouds
    createClouds(pos) {
        return this.meshes.add(new Particles_Clouds(this.renderer.gl, pos));
    }

    // setRain
    setRain(value) {
        if(value) {
            if(!this.rainTim) {
                this.rainTim = setInterval(function(){
                    let pos = Game.world.localPlayer.pos;
                    Game.world.rainDrop(new Vector(pos.x, pos.y + 20, pos.z));
                }, 25);
            }
        } else {
            if(this.rainTim) {
                clearInterval(this.rainTim);
                this.rainTim = null;
            }
        }
    }

    // randomTeleport
    randomTeleport() {
        this.localPlayer.pos.x = 1000 + Math.random() * 2000000;
        this.localPlayer.pos.y = 120;
        this.localPlayer.pos.z = 1000 + Math.random() * 2000000
    }

    // underWaterfall
    underWaterfall() {
        this.setBlock(parseInt(this.localPlayer.pos.x), CHUNK_SIZE_Y - 1, parseInt(this.localPlayer.pos.z), BLOCK.FLOWING_WATER, 1);
    }

    addRotate(vec3) {
        const speed     = 1.0;
        this.rotate.x   -= vec3.x; // взгляд вверх/вниз (pitch)
        this.rotate.z   += vec3.z * speed; // Z поворот в стороны (yaw)
        this.fixRotate();
    }

    fixRotate() {
        // let halfYaw = (Game.render.canvas.width || window.innerWidth) * 0.5;
        let halfPitch = (Game.render.canvas.height || window.innerHeight) * 0.5;
        if(this.rotate.z <= -1800) {
            this.rotate.z = 1799.9;
        }
        if(this.rotate.z >= 1800) {
            this.rotate.z = -1800;
        }
        //
        this.rotate.x = Math.max(this.rotate.x, -halfPitch);
        this.rotate.x = Math.min(this.rotate.x, halfPitch);
        let x = (this.rotate.x / halfPitch) * 90;
        let y = 0;
        let z = this.rotate.z / 10;
        this.rotateRadians.x = Helpers.deg2rad(x);
        this.rotateRadians.y = Helpers.deg2rad(y);
        this.rotateRadians.z = Helpers.deg2rad(z);
        this.rotateDegree.x = Helpers.rad2deg(this.rotateRadians.x);
        this.rotateDegree.y = Helpers.rad2deg(this.rotateRadians.y);
        this.rotateDegree.z = Helpers.rad2deg(this.rotateRadians.z) + 180;
    }

    // update
    update() {
        /* if(Game.world.localPlayer) {
            let pos = Game.world.localPlayer.pos;
            if(Math.abs(pos.x - Game.shift.x) > MAX_DIST_FOR_SHIFT || Math.abs(pos.z - Game.shift.z) > MAX_DIST_FOR_SHIFT) {
                Game.shift.x    = pos.x;
                Game.shift.z    = pos.z;
                let tm          = performance.now();
                let points      = this.chunkManager.shift({...Game.shift});
                console.info('SHIFTED', Game.shift, (Math.round((performance.now() - tm) * 10) / 10) + 'ms', points);
            }
        } */
        this.chunkManager.update();
    }

    // exportJSON
    exportJSON(callback) {
        let that = this;
        let row = {
            id:                 Game.world_name,
            seed:               Game.seed,
            spawnPoint:         that.spawnPoint,
            pos:                that.localPlayer.pos,
            flying:             that.localPlayer.flying,
            generator:          this._savedState.generator,
            chunk_render_dist:  Game.world.chunkManager.CHUNK_RENDER_DIST,
            rotate:             that.rotate,
            brightness:         that.renderer.brightness,
            game_mode:          that.game_mode.getCurrent().id,
            inventory:  {
                items: Game.world.localPlayer.inventory.exportItems(),
                current: {
                    index: Game.world.localPlayer.inventory.index
                }
            }
        };
        if(callback) {
            callback(row);
        } else {
            Helpers.saveJSON(row, Game.world_name + '.json');
        }
    }

    // saveToDB
    saveToDB(callback) {
        Game.saves.save(this, callback);
        return;
    }

}
