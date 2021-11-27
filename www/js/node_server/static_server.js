import express from "express"; 

export class StaticServer {

    static init() {

        // Serve static files
        // http://expressjs.com/en/api.html#req.originalUrl
        var app = express();
        // Serves resources from public folder
        app.use(express.static('./'));
        // JSONRpc API
        app.use(express.json());
        app.use('/api', function(req, res) {
            console.log('> API:' + req.originalUrl);
            let session_id = req.get('x-session-id');
            switch(req.originalUrl) {
                case '/api/Game/MyWorlds': {
                    res.status(200).json([
                        {"id":1,"user_id":0,"dt":"2021-10-06T19:20:04+02:00","guid":"demo","title":"🤖 Demo public server","seed":"undefined","game_mode":"","generator":{"id":"biome2"},"pos_spawn":null,"state":null},
                        {"id":5,"user_id":0,"dt":"2021-10-20T17:59:48+02:00","guid":"2826254e-fd5a-49f2-a328-8f288c9d34a2","title":"city","seed":"1691782501","game_mode":"","generator":{"id":"city"},"pos_spawn":null,"state":null},
                        {"id":14,"user_id":0,"dt":"2021-11-03T13:01:58+01:00","guid":"a8a203c4-bde5-42d7-af3f-e9d0cd66ed1b","title":"My world!","seed":"1537005267","game_mode":"","generator":{"id":"biome2"},"pos_spawn":null,"state":null}
                    ]);
                    break;
                }
                case '/api/Game/CreateWorld': {
                    // > {"title":"777","seed":"3725701570","generator":{"id":"biome2"}}
                    let seed        = req.body.seed;
                    let title       = req.body.title;
                    let generator   = req.body.generator;
                    let game_mode   = 'survival';
                    let pos_spawn   = null;
                    let guid        = '';
                    let dt          = '';
                    let user_id     = '';
                    console.log('body', req.body, session_id);
                    break;
                }
                default: {
                    console.log('> API: Method not exists ' + req.originalUrl);
                    break;
                }
            }
        });
        var server = app.listen(5700);
    }
}