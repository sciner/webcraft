# MadCraft
Minecraft clone on JS

- Demo: https://madcraft.io/
- Discord: https://discord.gg/QQw2zadu3T
- Youtube: https://www.youtube.com/channel/UCAcOZMpzYE8rk62giMgTwdw/videos
- Reddit: https://www.reddit.com/r/madcraft/

## Third Party
+ [XM player](https://github.com/a1k0n/jsxm/)

## Run and play

Compilate texture pack. It require for first run the game, because textures not included in repo.
For example you can download this texture pack from https://polyflore.net/projects/depixel
```
1. extract resource pack to directory ../resource-packs/1 (one level up from project root directory)
2. cd ./node_server
3. npm install
4. npm run compile-texture-pack
```

Start server:
```
// Run NodeJS v17.9.0 server!
cd ./node_server
npm run install
npm run start

# compile all include local server if need
npm run install-all

# compile ff-worker and auto start
cd ./ff-worker
npm i
cd ../node_server
npm run start-rollup
```

## Commands
```JS
// Teleport current user to random location 
Qubatch.player.teleport('random', null);

// Toggle rain
Qubatch.render.setWeather('rain'); // rain|snow|clear

// Set block at current player coordinates
let pp = Qubatch.player.getBlockPos();
Qubatch.world.chunkManager.setBlock(pp.x, pp.y, pp.z, {id: 10}, true);

// Emulate user keyboard control
// .walk(direction, duration_milliseconds)
Qubatch.player.walk('forward', 2000); // forward|back|left|right

// Get player rotate
let rotate = Qubatch.player.rotate;

// Set player rotate
Qubatch.player.setRotate({x: 0, y: 0, z: 0});

// Send message to chat
Qubatch.player.chat.sendMessage('Hello, World!');

// Get all supported blocks
let blocks = Qubatch.world.block_manager.getAll();

// Change game mode
Qubatch.world.server.GameModeSet('creative'); // survival|creative|adventure|spectator

// Open inventory window
Qubatch.player.inventory.open();

// Spawn mob
Qubatch.player.chat.sendMessage('/spawnmob 3880 71 2527 horse creamy');
Qubatch.player.chat.sendMessage('/spawnmob 3880 71 2527 bee base');

// Play sounds
Qubatch.sounds.play('madcraft:block.chicken', 'idle');
Qubatch.sounds.play('madcraft:block.chicken', 'step');
Qubatch.sounds.play('madcraft:block.chicken', 'death');
Qubatch.sounds.play('madcraft:block.player', 'hit');

// Admins
// 1. admin list managed only by chat commands
// 2. only owner or another admin can add new admin
// 3. owner cannot be removed from admins
/admin list
/admin add username
/admin remove username
```

## Server packets
Send particle animation from server to player:
```JS
const packets = [{
    name: ServerClient.CMD_PARTICLE_BLOCK_DESTROY,
    data: {
        pos: {x: 100, y: 100, z: 100},
        item: {id: 2}
    }
}];
chunk.sendAll(packets, []);
```
## Manage server by chat commands
- ### /gamerule doDaylightCycle false|true
    You can stop the day and night shift with the command /gamerule doDaylightCycle false
    To disable the day and night shift, you need to assign false to the rule
    At this moment, the current position of the sun and moon will be "fixed".
    Time will go on, but the change of day and night will freeze until you set the rule to true

    **Note!**  
    The command works only in worlds where the player has admin rights or he is its creator.  
    If you need to stop the daylight time, and it's dark now, then before disabling the day and night shift, you first need to set the daylight time with the command /time set day

- ### /time set day|midnight|night|noon
    You can change current world time by following commands
    * `/time set  day` equal to 07:00
    * `/time set  midnight` equal to 00
    * `/time set  night` equal to 19:00
    * `/time set  noon` equal to 12:00

    You can set specific daytime `/time set 16500` it equal to 16:30.  
    You can increase time by /add argument `/time add 1000`, this add one hour to current time.  

    **Note!**  
    The command works only in worlds where the player has admin rights or he is its creator.

- ### /vdist 2-16
    You can change view distance by this command
    * `/vdist 2` means 2 chunks showed around player
    * `/vdist 16` means 16 chunks render around player

    **Note!**  
    View distance can take number from 2 to 16

## Portals
You can made 3 type of portals:

- ### Portal to bottom caves
    - You must build a frame from OBSIDIAN (minimum size 4x5) and must activate the portal by applying FLINT_AND_STEEL to the inside of the frame;
    - You cannot activate the portal if the bottom border is below -500 blocks.

- ### Portal to flying islands (aether)
    - You must build a frame from GLOWSTONE (minimum size 4x5) and must activate the portal by applying FLINT_AND_STEEL to the inside of the frame;
    - You cannot activate the portal if the bottom border is above 500 blocks.

- ### Portal to routine world (main level)
    - You must build a frame from PRISMARINE (minimum size 4x5) and must activate the portal by applying FLINT_AND_STEEL to the inside of the frame;
    - You cannot activate the portal if the bottom border is between 0 - 500 blocks.

## Generate particles from server
```JS
const actions = new WorldAction();
// Where type can be one from [campfire_flame|explosion|music_note|torch_flame|...]
actions.addParticles([{type: 'explosion', pos: vec_center}]);
```

1. It is necessary to create an emitter, for example, as an explosion, it is disposable. The emitters are located in the `mesh/effect/emitter` folder

2. Next, the emitter must be registered in `mesh/effect/manager.js` after line 32

3. While the emitter method `canDelete()` returns true, it will exist and on each frame it will call the `emit()` method, which should return an array of generated particles, the answer may be an empty array, it will not affect anything, just this time no particles will be generated and the next frame will be called again the `emit()` method

4. The emitter has a static variable `textures`, there you need to register an array of texture addresses from the file `./www/resource_packs/extend/textures/effects.png`

5. For an example of creating a new emitter, see the `addExplosionParticles()` method in `./www/js/render.js`

### Important:
The explosion emitter is an example of a one-time emitter, it counts how many times the `emit()` method was called, and does not allow it to be done more than once, and its `canDelete()` method returns true if `emit()` was called at least once

## Assignment of classes related to particles:
1. `Mesh_Effect_Particle` - the basic particle of the effect with the implementation of physics
2. `Mesh_Effect` - a mesh that consists of particles generated by emitters
3. `Mesh_Effect_Manager` - Creates and destroys emitters, places particles generated by emitters in a mesh

## Debug
1. `F3` + `G` - toggle chunk borders OR by chat command `/chunkborders [true|false]`
2. `F3` + `B` - toggle mobs borders OR by chat command `/mobborders [true|false]`

## Performance
To best performance use Chrome and turn on this flag `chrome://flags/#enable-webgl-draft-extensions` (this enable multidraw for chunks)