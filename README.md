# MadCraft
Minecraft clone on JS

# Run and play
```
go run .\main.go
open http://localhost:5700/
```

# Commands
```JS
// Teleport current user to random location 
Game.world.player.teleport('random', null);

// Draw current user model at current location
Game.world.createClone();

// Toggle rain
Game.world.setRain(true);

// Set block at current player coordanates
let pp = Game.world.player.getBlockPos();
Game.world.setBlock(pp.x, pp.y, pp.z, {id: 10}, 1, null);

// Emulate user keyboard control
// .walk(direction, duration_milliseconds)
Game.world.player.walk('forward', 2000); // forward|back|left|right

// Get player rotate
let rotate = Game.world.player.rotate;

// Set player rotate
Game.world.player.setRotate({x: 0, y: 0, z: 0});

// Send message to chat
Game.world.player.chat.sendMessage('Hello, World!');

// Get all supported blocks
let blocks = Game.block_manager.getAll();

// Change game mode
Game.world.game_mode.setMode('creative'); // survival|creative|adventure|spectator

// Open inventory window
Game.world.player.inventory.open();
```