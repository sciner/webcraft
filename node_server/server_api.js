import express from "express"; 

export class ServerAPI {

    static init(app) {
        // JSONRpc API
        app.use(express.json());
        app.use('/api', async(req, res) => {
            console.log('> API:' + req.originalUrl);
            try {
                switch(req.originalUrl) {
                    case '/api/User/Registration': {
                        let session = await Game.db.Registration(req.body.username, req.body.password);
                        res.status(200).json(session);
                        break;
                    }
                    case '/api/User/Login': {
                        let session = await Game.db.Login(req.body.username, req.body.password);
                        res.status(200).json(session);
                        break;
                    }
                    case '/api/Game/CreateWorld': {
                        let title       = req.body.title;
                        let seed        = req.body.seed;
                        let generator   = req.body.generator;
                        let game_mode   = 'survival';
                        let session     = await Game.db.GetPlayerSession(req.get('x-session-id'));
                        let world       = await Game.db.InsertNewWorld(session.user_id, generator, seed, title, game_mode);
                        res.status(200).json(world);
                        break;
                    }
                    case '/api/Game/JoinWorld': {
                        const world_guid = req.body.world_guid;
                        const session    = await Game.db.GetPlayerSession(req.get('x-session-id'));
                        const world      = await Game.db.JoinWorld(session.user_id, world_guid);
                        res.status(200).json(world);
                        break;
                    }
                    case '/api/Game/MyWorlds': {
                        let session = await Game.db.GetPlayerSession(req.get('x-session-id'));
                        let result = await Game.db.MyWorlds(session.user_id);
                        res.status(200).json(result);
                        break;
                    }
                    default: {
                        throw 'error_method_not_exists';
                        break;
                    }
                }
            } catch(e) {
                console.log('> API: ' + e);
                let message = e.code || e;
                let code = 950;
                if(message == 'error_invalid_session') {
                    code = 401;
                }
                res.status(200).json(
                    {"status":"error","code": code, "message": message}
                );
            }
        });
    }

}