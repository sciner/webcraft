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
Game.world.localPlayer.teleport('random', null);

// Draw current user model at current location
Game.world.createClone();

// Toggle rain
Game.world.setRain(true);

// Set block at current player coordanates
let pp = Game.world.localPlayer.getBlockPos();
Game.world.setBlock(pp.x, pp.y, pp.z, {id: 10}, 1, null);

// Emulate user keyboard control
// .walk(direction, duration_milliseconds)
Game.player.walk('forward', 2000); // forward|back|left|right

// Get player rotate
Game.player.rotate

// Set player rotate
Game.player.setRotate({x: 0, y: 0, z: 0});
```