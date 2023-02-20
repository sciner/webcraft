import { GAME_DAY_SECONDS } from "../../www/src/constant.js";

const DAY_TIMES = {
    day: 7000,
    midnight: 0,
    night: 19000,
    noon: 12000,
};

function addWorldTime(world, value) {
    world.info.add_time += value;
    world.db.updateAddTime(world.info.guid, world.info.add_time);
    world.updateWorldCalendar();
    world.sendUpdatedInfo();
}

export default class Chat_Time {

    static targets = ['chat'];

    onGame(game) {}

    onWorld(world) {}

    onChat(chat) {
        chat.onCmd(async (player, cmd, args) => {
            switch(cmd) {
                case '/time': {
                    args = chat.parseCMD(args, ['string', 'string', 'string']);
                    if(args.length == 3) {
                        const world = player.world;
                        if(!world.admins.checkIsAdmin(player)) {
                            throw 'error_not_permitted';
                        }
                        if(args[1] == 'add') {
                            let value = args[2];
                            if(!isNaN(value)) {
                                value = parseInt(value);
                                if(value > 0) {
                                    addWorldTime(world, value);
                                }
                            }
                        } else if(args[1] == 'set') {
                            let value = args[2];
                            let target_time = -1;
                            if(isNaN(value)) {
                                if(value in DAY_TIMES) {
                                    target_time = DAY_TIMES[value];
                                }
                            } else {
                                target_time = parseInt(value);
                            }
                            if(target_time < 0 || target_time > GAME_DAY_SECONDS) {
                                throw 'error_time_value';
                            }
                            let age = world.info.calendar.age + world.info.calendar.day_time / GAME_DAY_SECONDS;
                            let day_time = (age - Math.floor(age)) * GAME_DAY_SECONDS;
                            addWorldTime(world, Math.round(target_time - day_time));
                        }
                        return true;
                    }
                    break;
                }
            }
            return false;
        });
    }

}