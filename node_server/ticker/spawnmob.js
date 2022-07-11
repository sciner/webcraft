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
        //console.log(extra_data);
        if(v.ticks % extra_data.max_ticks == 0) {
            const pos = v.pos.clone();
            
            //Один раз спаун
            if (extra_data.limit.count && extra_data.limit.count == 1) {
                const spawn_pos = pos.add(new Vector(.5, 0, .5));
                const params = {
                    type           : extra_data.type,
                    skin           : extra_data.skin,
                    pos            : spawn_pos,
                    pos_spawn      : spawn_pos.clone(),
                    rotate         : new Vector(0, 0, 0).toAngles()
                };
                
                // Spawn mob
                await world.mobs.create(params); 
                const updated_blocks = [];
                updated_blocks.push({pos: pos, item: {id: BLOCK.AIR.id}, action_id: ServerClient.BLOCK_ACTION_MODIFY});
                console.log('One spawn mob', pos.toHash());
                // Delete completed block from tickings
                this.delete(v.pos);
                return updated_blocks;
            }
            
            extra_data.max_ticks = Math.random() * 600 | 0 + 200;
             //Проврерям наличие игроков в радиусе 16 блоков
            const players = world.getPlayersNear(pos, 16, false);
            if (players.length == 0) {
                return;
            }
            
            //Проврерям количество мобов в радиусе(в радиусе 4 блоков не должно быть больше 5 мобов)
            const mobs = world.getMobsNear(pos, 9);
            if (mobs.length >= 6) {
                console.log("mobs.length >= 6")
                console.log(mobs)
                return;
            }
            
            //Место спауна моба, 4 попытки. Если на координатак моб, игрок или блок, то не спауним
            for (let i = 0; i < 4; i++) {
                const x = (Math.random() * 4 | 0) - (Math.random() * 4 | 0);
                const z = (Math.random() * 4 | 0) - (Math.random() * 4 | 0);
                const y = Math.random() * 2 | 0;
                const spawn_pos = pos.addSelf(new Vector(x, y, z)).flooredSelf();
                let blocking = false;
                for (let player of players) { 
                    player.state.pos.flooredSelf();
                    console.log("player.state.pos:" + player.state.pos);
                    if (player.state.pos.x == spawn_pos.x && player.state.pos.z == spawn_pos.z) {
                        blocking = true;
                        break;
                    }
                }
                
                for (let mob of mobs) {
                    mob.pos.flooredSelf();
                    console.log("mob.pos:" + mob.pos);
                    if (mob.pos.x == spawn_pos.x && mob.pos.z == spawn_pos.z) {
                        blocking = true;
                        break;
                    }
                }
                //Проверяем есть ли блок на пути и что под ногами для нейтральных мобов
                const body = world.getBlock(spawn_pos);
                const legs = world.getBlock(spawn_pos.sub(Vector.YP));
                if (body.id != 0) {
                    blocking = true;
                }
                console.log('blocking: ' + blocking);
                if (!blocking) {
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
        
        return;
    }

}