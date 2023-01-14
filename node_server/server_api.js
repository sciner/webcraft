import { GameMode } from "../www/js/game_mode.js";
import { BuildingTemplate } from "../www/js/terrain_generator/cluster/building_template.js";
import { WorldGenerators } from "./world/generators.js";

const FLAG_SYSTEM_ADMIN = 256;

// JSON API
export class ServerAPI {

    static getDb() {
        return Qubatch.db
    }

    //
    static async isWorldAdmin(world_guid, session) {
        const world = Qubatch.worlds.get(world_guid);
        if(!world) {
            return false;
        }
        return world.admins.checkIsAdmin({session});
    }

    static async call(method, params, session_id, req) {
        console.debug('!> API:' + method);
        switch(method) {
            case '/api/Game/getWorldPublicInfo':
                const world = await ServerAPI.getDb().getWorld(params.worldGuid);
                // mapping
                const woldPublicInfo = {
                    title: world.title,
                    guid: world.guid,
                    // [TO DO] image of world should be put here
                    cover: world.cover ? `/worldcover/${world.guid}/screenshot/${world.cover}` : null
                };
                return woldPublicInfo;
            case '/api/Game/loadSchemas':
                return Array.from(BuildingTemplate.schemas.values())
            case '/api/User/Registration': {
                const session = await ServerAPI.getDb().Registration(params.username, params.password);
                Log.append('Registration', {username: params.username});
                return session;
            }
            case '/api/User/Login': {
                const session = await ServerAPI.getDb().Login(params.username, params.password);
                Log.append('Login', {username: params.username});
                return session;
            }
            case '/api/Game/CreateWorld': {

                // check admin rights for specific world
                if([config.building_schemas_world_name].includes(params.title)) {
                    const session = await ServerAPI.getDb().GetPlayerSession(session_id)
                    ServerAPI.requireSessionFlag(session, FLAG_SYSTEM_ADMIN)
                    params.game_mode = 'creative'
                    params.generator = { id: 'flat', options: {} }
                }

                const title       = params.title;
                const seed        = params.seed;
                const generator   = WorldGenerators.validateAndFixOptions(params.generator);
                const game_mode   = params.game_mode ?? 'survival';
                const session     = await ServerAPI.getDb().GetPlayerSession(session_id);
                const world       = await ServerAPI.getDb().InsertNewWorld(session.user_id, generator, seed, title, game_mode);
                Log.append('InsertNewWorld', {user_id: session.user_id, generator, seed, title, game_mode});
                return world;
            }
            case '/api/Game/JoinWorld': {
                const world_guid = params.world_guid;
                const session    = await ServerAPI.getDb().GetPlayerSession(session_id);
                const world      = await ServerAPI.getDb().JoinWorld(session.user_id, world_guid);
                Log.append('JoinWorld', {user_id: session.user_id, world_guid});
                return world;
            }
            case '/api/Game/MyWorlds': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                const resp = await ServerAPI.getDb().MyWorlds(session.user_id);
                for(let item of resp) {
                    const world = Qubatch.worlds.get(item.guid);
                    item.players_online = world ? world.players.count : 0;
                }
                return resp;
            }
            case '/api/Game/DeleteWorld': {
                const world_guid = params.world_guid;
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                const resp = await ServerAPI.getDb().DeleteWorld(session.user_id, world_guid);
                return resp;
            }
            case '/api/Game/Online': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                ServerAPI.requireSessionFlag(session, FLAG_SYSTEM_ADMIN);
                const resp = {
                    dt_started: Qubatch.dt_started,
                    players_online: 0,
                    worlds: []
                };
                for(let world of Qubatch.worlds.values()) {
                    if(world.info) {
                        const info = {...world.info, players: []};
                        for(const [_, player] of world.players.all()) {
                            info.players.push({
                                user_id: player.session.user_id,
                                username: player.session.username,
                                ...player.state,
                                dt_connect: player.dt_connect
                            });
                            resp.players_online++;
                        }
                        resp.worlds.push(info);
                    }
                }
                return resp;
            }
            case '/api/Game/Screenshot': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                const params = req.body;
                const world_id = params.world_id.replace(/[^a-z0-9-]/gi, '').substr(0, 36);
                if(!ServerAPI.isWorldAdmin(world_id, session)) {
                    throw 'error_not_permitted';
                }
                if (req.files && session) {
                    const filename = await ServerAPI.getDb().InsertScreenshot(world_id, params.as_cover == 'true');
                    if(filename) {
                        const file = req.files.file;
                        if(typeof fs === 'undefined') {
                            throw 'error_fs_not_found';
                            /*
                            const path = '../worldcover/' + world_id + '/screenshot/';
                            caches.open('game-cache').then(async (cache) => {
                                await cache.put(path + filename, new Response(file));
                            });
                            */
                        } else {
                            const path = '../world/' + world_id + '/screenshot/';
                            if (!fs.existsSync(path)) {
                                fs.mkdirSync(path, {recursive: true});
                            }
                            file.mv(path + filename);
                        }
                        return {'result':'ok'};
                    }
                }
                return {'result':'error'};
            }
            case '/api/Game/Generators': {
                return WorldGenerators.list;
            }
            case '/api/Game/Gamemodes': {
                const game_modes = new GameMode();
                const list = [];
                for(let gm of game_modes.modes) {
                    list.push({id: gm.id, title: gm.title});
                }
                return list;
            }
            case '/api/Skin/Upload': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                const params = req.body;
                const skin_id = await ServerAPI.getDb().skins.upload(params.data, params.name, params.type, session.user_id);
                return {'skin_id': skin_id};
            }
            case '/api/Skin/GetOwned': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                return await ServerAPI.getDb().skins.getOwned(session.user_id);
            }
            case '/api/Skin/DeleteFromUser': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                const params = req.body;
                await ServerAPI.getDb().skins.deleteFromUser(session.user_id, params.skin_id);
                return {'result': 'ok'};
            }
            case '/api/Skin/UpdateStatic': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                ServerAPI.requireSessionFlag(session, FLAG_SYSTEM_ADMIN);
                return await ServerAPI.getDb().skins.updateStaticSkins();
            }
            default: {
                throw 'error_method_not_exists';
            }
        }
    }

    // requireSessionFlag...
    static requireSessionFlag(session, flag) {
        if((session.flags & flag) != flag) {
            throw 'error_require_permission';
        }
        return true;
    }

}