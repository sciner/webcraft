export class ServerPlayerDamage {
    
    constructor(player) {
        this.player = player;
    }

    tick(delta, tick_number) {
        const player = this.player;
        const world = player.world;
        const params = {
            tick_number,
            tblocks: {
                head: world.getBlock(player.getEyePos().floored()),
                legs: world.getBlock(player.state.pos.floored())
            }
        }
        // Утопление + удушение
        this.checkLackOfOxygenAndAsphyxiation(params);
    }

    // Check lack of oxygen and asphyxiation
    checkLackOfOxygenAndAsphyxiation(params) {
        const player = this.player;
        const world = player.world;
        if(player.is_dead || !player.game_mode.getCurrent().asphyxiation) {
            return false;
        }
        const LOST_TICKS = 10;
        const GOT_TICKS = 5;
        if(((params.tick_number % LOST_TICKS) != 0) && (params.tick_number % GOT_TICKS) != 0) {
            return false;
        }
        const ind_def = world.getDefaultPlayerIndicators().oxygen;
        const ind_player = player.state.indicators[ind_def.name];
        const mat = params.tblocks.head.material;
        const block_has_oxygen = !(mat.is_fluid || (mat.id > 0 && mat.passable == 0 && !mat.transparent));
        if(block_has_oxygen) {
            if((params.tick_number % GOT_TICKS) == 0) {
                if(ind_player.value < ind_def.value) {
                    player.changeIndicator(ind_def.name, 1)
                }
            }
        } else {
            if((params.tick_number % LOST_TICKS) == 0) {
                if(ind_player.value > 0) {
                    player.changeIndicator(ind_def.name, -1);
                } else {
                    player.changeIndicator('live', -1);
                }
            }
        }
    }

}