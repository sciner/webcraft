import { Vector } from "@client/helpers.js";
import conf from "../data/conf.json" assert { type: "json" };
import conf_world_json from "../data/conf_world.json" assert { type: "json" };
import conf_building_schemas from "../data/building_schemas.json" assert { type: "json" };

const conf_world : any = conf_world_json;
(conf_world as any).building_schemas = conf_building_schemas

if(typeof process != 'undefined') {
    process.argv.forEach((e, i) => {
        // should skip first
        if(i === 0) {
            return;
        }
        const [name, value] = e.replace('--', '').split('=');
        if (!(name in conf)) {
            return;
        }
        if (typeof value ==='undefined') {
            conf[name] = true;
        } else {
            conf[name] = isNaN(+value) ? value : +value;
        }
    });
}

const all = []

// 1. load building_schemas
for(let k in conf_world.building_schemas.list) {
    const item = conf_world.building_schemas.list[k]
    all.push(import(`../data/building_schema/${item.name}.js`).then(module => {
        const json = module.default
        json.name = item.name
        json.meta = json.meta ?? {}
        if(item.meta) {
            json.meta = Object.assign(json.meta, item.meta)
        }
        item.entrance = new Vector(json.world.entrance)
        json.world = {...json.world, ...item}
        conf_world.building_schemas.list[k] = json
    }))
}

// 2. load chat_plugins
for(let k in conf_world.chat_plugins) {
    const filename = conf_world.chat_plugins[k]
    delete(conf_world.chat_plugins[k])
    if(filename.startsWith('-')) {
        continue
    }
    all.push(import(`./plugins/${filename}.js`).then(module => {
        conf_world.chat_plugins[filename] = module.default
    }))
}

export class Config {
    AppVersion:         string
    AppCode:            string
    ServerIP:           string
    Port:               number
    Addr:               string
    JSONRPCEndpoint:    string
    ApiKey:             string
    APIDomain:          string
    DomainURL:          string
    ProjectName:        string
    UseSecureProtocol:  boolean
    SSLCertFile:        string
    SSLKeyFile:         string
    Debug:              boolean
    building_schemas:   any;
    chat_plugins:       {[filename: string]: any}

    // world
    world = {
        // Через сколько секунд воркер будет убит если от него не поступают сообщения
        kill_timeout_seconds: 600,
        // Сколько остается в памяти мир без игроков в котором все важное сохранено
        ttl_seconds: 60,
    }

    // вождение
    driving = {
        // Если моб-участник движения отсутсвует на сервере (может не загружен из-за тормозов, или нарушилась целостность
        // данных из-за бага), но числится в вождении - через сколько секунд его выкидывать из вождения.
        absent_mob_ttl_seconds: 30,
        // Если игрок-учстник движения отсутсвует на сервере (вышел из игры), но числится в вождении, он будет из него удален,
        // если транспортное средство сместится более чем на это расстояние от того места, где он участник был последний раз.
        absent_player_distance: 20,
        // Через сколько секунд после временного исчезновения из игры игрока-водителя начинает работать ИИ моба.
        absent_player_mob_brain_delay_seconds: 10,
    }

    // gamemode options
    gamemode = {
        // Если true, клиент может при входе в мир сказать что он бот, и сразу использовать режим наблюдателя не будучи админом.
        // TODO: отключить в релизе
        spectator_bots_enabled: true,
    }

    // world transaction options
    world_transaction = {
        // the time (in ms) between world-saving transactions
        world_transaction_period: 2000,
        // Max. chunks saved to world_modify_chunks per transaction
        // Increasing this number allows them to unload faster.
        world_modify_chunks_per_transaction: 10,
        // Additional timeout after World Transaction and fluids write everything, before exiting the process.
        // It's to allow any other async queries (not included in world transaction or fluids) to finish.
        shutdown_additional_timeout: 1000,
    }

    constructor() {
        Object.assign(this, conf)
        Object.assign(this, conf_world)
    }

    static init() : Promise<Config> {
        return new Promise(async resolve => {
            await Promise.all(all)
            resolve(new Config())
        })
    }

}