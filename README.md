# MadCraft
Minecraft clone on JS

# Run and play
```
// Run GO server
go run .\main.go
open http://localhost:5700/

// Run NodeJS server
cd .\www
node --experimental-json-modules --no-warnings .\js\node_server\index.js

// Test working NodeJS server from Chrome dev console:
let ws = new WebSocket('ws://localhost:5701');
ws.onmessage = function(e) {
    console.log(e.data);
};
ws.onopen = function(event) {
    let packet = ['ping', null];
    let json = JSON.stringify(packet);
    this.send(json);
};
```

# Commands
```JS
// Teleport current user to random location 
Game.player.teleport('random', null);

// Draw current user model at current location
Game.world.createClone();

// Toggle rain
Game.world.setRain(true);

// Set block at current player coordanates
let pp = Game.player.getBlockPos();
Game.world.setBlock(pp.x, pp.y, pp.z, {id: 10}, 1, null);

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
Game.world.game_mode.setMode('creative'); // survival|creative|adventure|spectator

// Open inventory window
Game.player.inventory.open();
```