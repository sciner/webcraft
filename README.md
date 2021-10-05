# MadCraft
Minecraft clone on JS

# Run and play
```
go run .\main.go
open http://localhost:5700/
```

# Commands
```JS
// Export current player state to JSON
Game.world.exportJSON();

// Teleport current user to random location 
Game.world.randomTeleport();

// Draw current user model at current location
Game.world.createClone();

// Toggle rain
Game.world.setRain(true);

// Set block at current player coordanates
let pp = Game.world.localPlayer.getBlockPos();
Game.world.setBlock(pp.x, pp.y, pp.z, {id: 10, name: "BRICK"}, 1, null);
```
