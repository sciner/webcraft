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
    const file = conf_world.chat_plugins[k]
    delete(conf_world.chat_plugins[k])
    if(file.startsWith('-')) {
        continue
    }
    all.push(import(`./plugins/${file}.js`).then(module => {
        conf_world.chat_plugins[file] = module.default
    }))
}

export class Config {

    AppVersion: string
    AppCode: string
    ServerIP: string
    Port: number
    Addr: string
    JSONRPCEndpoint: string
    ApiKey: string
    APIDomain: string
    DomainURL: string
    ProjectName: string
    UseSecureProtocol: boolean
    SSLCertFile: string
    SSLKeyFile: string
    Debug: boolean

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