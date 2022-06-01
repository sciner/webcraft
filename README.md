# MadCraft
Minecraft clone on JS

- Demo: https://madcraft.io/
- Discord: https://discord.gg/QQw2zadu3T
- Youtube: https://www.youtube.com/channel/UCAcOZMpzYE8rk62giMgTwdw/videos
- Reddit: https://www.reddit.com/r/madcraft/
- 
# Run and play
```
// Run NodeJS v17.9.0 server!
cd ./node_server
npm install
node --experimental-json-modules --no-warnings ./index.js
```

# Commands
```JS
// Teleport current user to random location 
Game.player.teleport('random', null);

// Draw current user model at current location
Game.world.players.drawGhost(Game.player);

// Toggle rain
Game.render.setRain(true);

// Set block at current player coordinates
let pp = Game.player.getBlockPos();
Game.world.chunkManager.setBlock(pp.x, pp.y, pp.z, {id: 10}, true);

// Emulate user keyboard control
// .walk(direction, duration_milliseconds)
Game.player.walk('forward', 2000); // forward|back|left|right

// Get player rotate
let rotate = Game.player.rotate;

// Set player rotate
Game.player.setRotate({x: 0, y: 0, z: 0});

// Send message to chat
Game.player.chat.sendMessage('Hello, World!');

// Get all supported blocks
let blocks = Game.block_manager.getAll();

// Change game mode
Game.world.server.GameModeSet('creative'); // survival|creative|adventure|spectator

// Open inventory window
Game.player.inventory.open();

// Spawn mob
Game.player.chat.sendMessage('/spawnmob 3880 71 2527 horse creamy');
Game.player.chat.sendMessage('/spawnmob 3880 71 2527 bee base');

// Admins
// 1. admin list managed only by chat commands
// 2. only owner or another admin can add new admin
// 3. owner cannot be removed from admins
/admin list
/admin add username
/admin remove username
```

# Server packets
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

XM player: https://github.com/a1k0n/jsxm/
