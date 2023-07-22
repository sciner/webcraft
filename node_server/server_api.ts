import { GameMode } from "@client/game_mode.js";
import { BuildingTemplate } from "@client/terrain_generator/cluster/building_template.js";
import { WorldGenerators } from "./world/generators.js";
import { Vector } from "@client/helpers.js";
import {MonotonicUTCDate, TApiSyncTimeRequest, TApiSyncTimeResponse} from "@client/helpers/monotonic_utc_date.js";
import type { DBGame } from "db/game.js";
import Billboard from "player/billboard.js";
import { PLAYER_FLAG } from "@client/constant.js";
import { impl as alea } from '@vendors/alea.js';

// JSON API
export class ServerAPI {

    static getDb() : DBGame {
        return Qubatch.db
    }

    //
    static isWorldAdmin(world_guid, session) {
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
                const bw_config = config.building_world
                if(!bw_config) {
                    throw 'error_empty_building_world config'
                }
                if([bw_config.name].includes(params.title)) {
                    const session = await ServerAPI.getDb().GetPlayerSession(session_id)
                    ServerAPI.requireSessionFlag(session, PLAYER_FLAG.SYSTEM_ADMIN)
                    params.game_mode = bw_config.game_mode ?? 'creative'
                    params.generator = bw_config.generator
                }

                // random map noise shift
                const alea_random = new alea(params.seed)
                const mns_rad = 50000
                const mns_min = 2000
                params.generator.options['map_noise_shift'] = new Vector(
                        Math.max(Math.round(alea_random.double() * mns_rad * 2), mns_min),
                        Math.max(Math.round(alea_random.double() * mns_rad * 2), mns_min),
                        Math.max(Math.round(alea_random.double() * mns_rad * 2), mns_min),
                    ).addScalarSelf(-mns_rad, -mns_rad, -mns_rad)

                //
                const generator = WorldGenerators.validateAndFixOptions(params.generator);

                // spawn pos
                const pos_spawn = new Vector().copyFrom(generator.pos_spawn);
                switch(generator?.id) {
                    case 'city':
                    case 'flat': {
                        pos_spawn.setScalar(0, 2, 0)
                        break
                    }
                    case 'city2': {
                        pos_spawn.setScalar(3000, 8, 3000)
                        break
                    }
                }

                //
                const title       = params.title;
                const seed        = params.seed;
                const game_mode   = params.game_mode ?? 'survival';
                const session     = await ServerAPI.getDb().GetPlayerSession(session_id);
                const world       = await ServerAPI.getDb().InsertNewWorld(session.user_id, generator, seed, title, game_mode, pos_spawn);
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
            case '/api/Game/EnterWorld': {
                const args = params as IEnterWorld
                const {location, world_guid} = args
                const session    = await ServerAPI.getDb().GetPlayerSession(session_id)
                const server_url = (location.protocol == 'https:' ? 'wss:' : 'ws:') +
                    '//' + location.hostname +
                    (location.port ? ':' + location.port : '') +
                    '/ws'
                Log.append('EnterWorld', {user_id: session.user_id, world_guid, server_url})
                return {server_url, world_guid}
            }
            case '/api/Game/MyWorlds': {
                const params = req.body
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
                ServerAPI.requireSessionFlag(session, PLAYER_FLAG.SYSTEM_ADMIN);
                const resp = {
                    dt_started: Qubatch.dt_started,
                    players_online: 0,
                    worlds: []
                };
                for(let world of Qubatch.worlds.values()) {
                    if(world.info) {
                        const info = {...world.info, players: []};
                        for(const player of world.players.values()) {
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
            case '/api/Game/UploadBillboardImage': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id)
                if (req.files && session) {
                    const path = `../www/upload/${session.user_id}/`
                    if (!fs.existsSync(path)) {
                        fs.mkdirSync(path, {recursive: true})
                    }
                    const name = req.files.file.name 
                    const ext = name.substr(name.lastIndexOf('.'))
                    const md5 = req.files.file.md5 // name = req.files.file.name.replace(/[^a-zа-я0-9\s\.\-_]/gi, '')
                    const file = path + md5 + ext
                    await req.files.file.mv(file)
                    await req.files.preview.mv(path + md5 + '_' + ext)
                    const files = await Billboard.getPlayerFiles(session.user_id)
                    return {
                        'result':'ok', 
                        'files': files, 
                        'last': {
                            'file': md5 + ext,
                            'demo': false
                        }
                    }
                }
                return {'result':'error'}
            }
            case '/api/Game/UploadScreenshot': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                const params = req.body;
                const world_id = params.world_id.replace(/[^a-z0-9-]/gi, '').substr(0, 36);
                if(!ServerAPI.isWorldAdmin(world_id, session)) {
                    throw 'error_not_permitted';
                }
                if (req.files && session) {
                    const filename = await ServerAPI.getDb().InsertScreenshot(world_id, params.as_cover == 'true');
                    if(filename) {
                        const screenshot_file = req.files.file;
                        const screenshot_file_preview = req.files.file_preview;
                        if(!screenshot_file_preview) {
                            throw 'error_screenshot_preview_not_found'
                        }
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
                            screenshot_file.mv(path + filename);
                            screenshot_file_preview.mv(path + `preview_${filename}`);
                        }
                        const world = Qubatch.worlds.get(world_id)
                        world.info.cover = filename
                        world.sendUpdatedInfo()
                        return {'result':'ok'};
                    }
                }
                return {'result':'error'};
            }
            case '/api/Game/Generators': {
                return WorldGenerators.list;
            }
            case '/api/Game/Gamemodes': {
                const list = [];
                for(let gm of GameMode.byIndex) {
                    list.push({id: gm.id, title: gm.title});
                }
                return list;
            }
            case '/api/SyncTime': { // the initial request to sync clocks, before a game begins
                const req = params as TApiSyncTimeRequest
                const resp: TApiSyncTimeResponse = {
                    clientUTCDate: req.clientUTCDate,
                    serverUTCDate: MonotonicUTCDate.now()
                }
                return resp
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
            case '/api/Skin/List': {
                const resp = []
                for(const skin of ServerAPI.getDb().skins.list) {
                    if(skin.can_select_by_player) {
                        resp.push(skin)
                    }
                }
                return resp
                // const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                // return await ServerAPI.getDb().skins.getOwned(session.user_id);
            }
            case '/api/Skin/DeleteFromUser': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                const params = req.body;
                await ServerAPI.getDb().skins.deleteFromUser(session.user_id, params.skin_id);
                return {'result': 'ok'};
            }
            case '/api/Skin/UpdateStatic': {
                const session = await ServerAPI.getDb().GetPlayerSession(session_id);
                ServerAPI.requireSessionFlag(session, PLAYER_FLAG.SYSTEM_ADMIN);
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