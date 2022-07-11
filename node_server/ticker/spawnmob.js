import {Vector} from "../../www/js/helpers.js";
import {BLOCK} from "../../www/js/blocks.js";
import {ServerClient} from "../../www/js/server_client.js";

export default class Ticker {

    static type = 'spawnmob'

    //
    static async func(world, chunk, v) {
        const tblock = v.tblock;
        const ticking = v.ticking;
        const extra_data = tblock.extra_data;
        const updated_blocks = [];
        
        if(v.ticks % extra_data.max_ticks == 0) {
            extra_data.max_ticks = Math.random() * 600 | 0 + 200;
            const pos = v.pos.clone();
            console.log(extra_data.max_ticks);
            
             //Проврерям наличие игроков в радиусе 16 блоков
            const players = world.getPlayersNear(pos, 16, true);
            if (players.length == 0) {
                return;
            }
            
            //Проврерям количество мобов в радиусе(в радиусе 4 блоков не должно быть больше 5 мобов)
            const mobs = world.getMobsNear(pos, 9);
            if (mobs.length >= 6) {
                return;
            }
            
            //Место спауна моба, 4 попытки. Если на координатак моб, игрок или блок, то не спауним
            for (let i = 0; i < 4; i++) {
                const x = (Math.random() * 4 | 0) - (Math.random() * 4 | 0);
                const z = (Math.random() * 4 | 0) - (Math.random() * 4 | 0);
                const y = Math.random() * 2 | 0;
                const spawn_pos = pos.addSelf(new Vector(x, y, z)).flooredSelf(); //@todo Вроде как не обязательно округление
                for (let player of players) {
                    if (player.state.pos.x == spawn_pos.x && player.state.pos.z == spawn_pos.z) {
                        return;
                    }
                }
                
                for (let mob of mobs) {
                    if (mob.pos.x == spawn_pos.x && mob.pos.z == spawn_pos.z) {
                        return;
                    }
                }
                //Проверяем есть ли блок на пути и что под ногами для нейтральных мобов
                const body = world.getBlock(spawn_pos);
                const legs = world.getBlock(spawn_pos.sub(Vector.YP));
                if (body.id != 0) {
                    return;
                }
                
                 const params = {
                    type           : extra_data.type,
                    skin           : extra_data.skin,
                    pos            : spawn_pos,
                    pos_spawn      : spawn_pos.clone(),
                    rotate         : new Vector(0, 0, 0).toAngles()
                };
                
                console.log('Spawn mob', pos.toHash());
                await world.mobs.create(params);
            }
        }
    }

}