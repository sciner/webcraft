const FLAG_SYSTEM_ADMIN = 256;

// JSON API
export class ServerAPI {

    static async call(method, params, session_id) {
        console.log('> API:' + method);
        switch(method) {
            case '/api/User/Registration': {
                const session = await Game.db.Registration(params.username, params.password);
                Log.append('Registration', {username: params.username});
                return session;
            }
            case '/api/User/Login': {
                const session = await Game.db.Login(params.username, params.password);
                Log.append('Login', {username: params.username});
                return session;
            }
            case '/api/Game/CreateWorld': {
                const title       = params.title;
                const seed        = params.seed;
                const generator   = params.generator;
                const game_mode   = 'survival';
                const session     = await Game.db.GetPlayerSession(session_id);
                const world       = await Game.db.InsertNewWorld(session.user_id, generator, seed, title, game_mode);
                Log.append('InsertNewWorld', {user_id: session.user_id, generator, seed, title, game_mode});
                return world;
            }
            case '/api/Game/JoinWorld': {
                const world_guid = params.world_guid;
                const session    = await Game.db.GetPlayerSession(session_id);
                const world      = await Game.db.JoinWorld(session.user_id, world_guid);
                Log.append('JoinWorld', {user_id: session.user_id, world_guid});
                return world;
            }
            case '/api/Game/MyWorlds': {
                const session = await Game.db.GetPlayerSession(session_id);
                const resp = await Game.db.MyWorlds(session.user_id);
                return resp;
            }
            case '/api/Game/Online': {
                const session = await Game.db.GetPlayerSession(session_id);
                ServerAPI.requireSessionFlag(session, FLAG_SYSTEM_ADMIN);
                const resp = {
                    dt_started: Game.dt_started,
                    players_online: 0,
                    worlds: []
                };
                for(let world of Game.worlds.values()) {
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