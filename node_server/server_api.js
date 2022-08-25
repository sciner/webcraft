const FLAG_SYSTEM_ADMIN = 256;

// JSON API
export class ServerAPI {

    static async call(method, params, session_id, req) {
        console.debug('!> API:' + method);
        switch(method) {
            case '/api/Game/getWorldPublicInfo':
                const world = await Qubatch.db.getWorld(params.worldGuid);
                // mapping
                const woldPublicInfo = {
                    title: world.title,
                    guid: world.guid,
                    // [TO DO] image of world should be put here
                    image: '/media/no-logo.svg'
                };
                return woldPublicInfo;
            case '/api/User/Registration': {
                const session = await Qubatch.db.Registration(params.username, params.password);
                Log.append('Registration', {username: params.username});
                return session;
            }
            case '/api/User/Login': {
                const session = await Qubatch.db.Login(params.username, params.password);
                Log.append('Login', {username: params.username});
                return session;
            }
            case '/api/Game/CreateWorld': {
                const title       = params.title;
                const seed        = params.seed;
                const generator   = params.generator;
                const game_mode   = 'survival';
                const session     = await Qubatch.db.GetPlayerSession(session_id);
                const world       = await Qubatch.db.InsertNewWorld(session.user_id, generator, seed, title, game_mode);
                Log.append('InsertNewWorld', {user_id: session.user_id, generator, seed, title, game_mode});
                return world;
            }
            case '/api/Game/JoinWorld': {
                const world_guid = params.world_guid;
                const session    = await Qubatch.db.GetPlayerSession(session_id);
                const world      = await Qubatch.db.JoinWorld(session.user_id, world_guid);
                Log.append('JoinWorld', {user_id: session.user_id, world_guid});
                return world;
            }
            case '/api/Game/MyWorlds': {
                const session = await Qubatch.db.GetPlayerSession(session_id);
                const resp = await Qubatch.db.MyWorlds(session.user_id);
                return resp;
            }
            case '/api/Game/DeleteWorld': {
                const world_guid = params.world_guid;
                const session = await Qubatch.db.GetPlayerSession(session_id);
                const resp = await Qubatch.db.DeleteWorld(session.user_id, world_guid);
                return resp;
            }
            case '/api/Game/Online': {
                const session = await Qubatch.db.GetPlayerSession(session_id);
                ServerAPI.requireSessionFlag(session, FLAG_SYSTEM_ADMIN);
                const resp = {
                    dt_started: Qubatch.dt_started,
                    players_online: 0,
                    worlds: []
                };
                for(let world of Qubatch.worlds.values()) {
                    if(world.info) {
                        const info = {...world.info, players: []};
                        for(let player of world.players.values()) {
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
                const session = await Qubatch.db.GetPlayerSession(session_id);
                if (req.files && session) {
                    const guid = req.body.world.replace(/[^a-z0-9-]/gi, '').substr(0, 36);
                    const title = await Qubatch.db.InsertScreenshot(guid);
                    if (title) {
                        const path = '../world/' + guid + '/screenshot/';
                        if (!fs.existsSync(path)) {
                            fs.mkdirSync(path, {recursive: true});
                        }
                        const file = req.files.body;
                        file.mv(path + title + '.webp');
                    }
                }
                return {};
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