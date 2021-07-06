// ==========================================
// Player
// This class contains the code that manages the local player.
// ==========================================

const PLAYER_HEIGHT     = 1.8;
const PICKAT_DIST       = 5;

// Creates a new local player manager.
function Player() {
    this.inventory              = null;
    this.client                 = null;
    this.falling                = false; // падает
    this.flying                 = false; // летит
    this.running                = false; // бежит
    this.moving                 = false; // двигается в стороны
    this.walking                = false; // идёт по земле
    this.walking_frame          = 0;
    this.angles                 = [0, Math.PI, 0];
    this.chat                   = new Chat();
    this.velocity               = new Vector(0, 0, 0);
}

// Assign the local player to a world.
Player.prototype.setWorld = function(world) {
    this.previousForwardDown    = performance.now();
    this.previousForwardUp      = performance.now();
	this.world                  = world;
    this.world.localPlayer      = this;
    this.keys                   = {};
    this.keys_fired             = {down: {}, up: {}};
    this.eventHandlers          = {};
    this.pos                    = world.saved_state ? new Vector(world.saved_state.pos.x, world.saved_state.pos.y, world.saved_state.pos.z) : world.spawnPoint;
    if(world.saved_state) {
        this.flying = !!world.saved_state.flying;
    }
    this.overChunk              = null;
}

// Assign the local player to a socket client.
Player.prototype.setClient = function(client) {
    this.client = client;
}

// Assign player to a inventory
Player.prototype.setInventory = function(inventory) {
	this.inventory = inventory;
}

// Set the canvas the renderer uses for some input operations.
Player.prototype.setInputCanvas = function(id) {
	var canvas = this.canvas = document.getElementById( id );
	var t = this;
    document.onkeydown  = function(e) {
        if (e.target.tagName != 'INPUT') {
            if(t._onKeyEvent(e, e.keyCode, true)) {
                return false;
            }
        }
        if (e.ctrlKey) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    }
    document.onkeyup = function(e) {
        if (e.target.tagName != 'INPUT') {
            if(t._onKeyEvent(e, e.keyCode, false)) {
                return false;
            }
        }
    }
    document.onkeypress  = function(e) {
        if(t.onKeyPress(e)) {
            return false;
        }
    }
	canvas.onmousedown  = function(e) {t.onMouseEvent(e, e.clientX, e.clientY, MOUSE.DOWN, e.which, e.shiftKey); e.stopPropagation(); e.preventDefault(); return false; }
	canvas.onmouseup    = function(e) {t.onMouseEvent(e, e.clientX, e.clientY, MOUSE.UP, e.which, e.shiftKey); e.stopPropagation(); e.preventDefault(); return false; }
    canvas.onmousemove  = function(e) {t.onMouseEvent(e, e.clientX, e.clientY, MOUSE.MOVE, e.which, e.shiftKey); return false; }
	canvas.onclick      = function(e) {t.onMouseEvent(e, e.clientX, e.clientY, MOUSE.CLICK, e.which, e.shiftKey); return false; }
}

// Hook a player event.
Player.prototype.on = function(event, callback) {
    this.eventHandlers[event] = callback;
}

//
Player.prototype.onScroll = function(down) {
    if(down) {
	    this.inventory.next();
    } else {
        this.inventory.prev();
    }
}

// Hook for keyboard input.
Player.prototype.onKeyPress = function(e) {
    var charCode = (typeof e.which == 'number') ? e.which : e.keyCode;
    var typedChar = String.fromCharCode(charCode);
    this.chat.typeChar(typedChar);
}

// Hook for keyboard input.
Player.prototype._onKeyEvent = function(e, keyCode, down) {

    var resp = null;

    if(down) {
        if(this.keys_fired.up[keyCode]) {
            this.keys_fired.up[keyCode] = false;
        }
        var first_press = this.keys_fired.down[keyCode];
        resp = this.onKeyEvent(e, keyCode, down, !first_press);
        this.keys_fired.down[keyCode] = true;
    } else {
        if(this.keys_fired.down[keyCode]) {
            this.keys_fired.down[keyCode] = false;
        }
        var first_press = this.keys_fired.up[keyCode];
        resp = this.onKeyEvent(e, keyCode, down, !first_press);
        this.keys_fired.up[keyCode] = true;
    }

    return resp;

}

// Hook for keyboard input.
Player.prototype.onKeyEvent = function(e, keyCode, down, first) {

    // Chat
    if(this.chat.active) {
        switch(keyCode) {
            case KEY.F5: {
                return false;
                break;
            }
            case KEY.ESC: {
                if(down) {
                    this.chat.close();
                    // Game.setupMousePointerIfNoOpenWindows();
                    return true;
                }
                break;
            }
            case KEY.BACKSPACE: {
                if(down) {
                    this.chat.backspace();
                    break;
                }
                return true;
            }
            /*case KEY.SLASH: {
                if(!down) {
                    this.chat.close();
                }
                return true;
                break;
            }*/
            case KEY.ENTER: {
                if(!down) {
                    this.chat.submit();
                }
                return true;
                break;
            }
        }
        return false;
    }

    var vw = Game.hud.wm.getVisibleWindows();
    if(vw.length > 0) {
        switch(keyCode) {
            // E (Inventory)
            case KEY.ESC:
            case KEY.E: {
                if(!down) {
                    Game.hud.wm.closeAll();
                    Game.setupMousePointer();
                    return true;
                }
                break;
            }
        }
        return;
    }

    //
    if(keyCode == KEY.PAGE_UP) {
        if(down) {
            Game.world.chunkManager.setRenderDist(CHUNK_RENDER_DIST + 1);
        }
    }

    //
    if(keyCode == KEY.PAGE_DOWN) {
        if(down) {
            Game.world.chunkManager.setRenderDist(CHUNK_RENDER_DIST - 1);
        }
    }

    //
    if(keyCode == KEY.SPACE) {
        if(this.velocity.z > 0) {
            if(down && first && !this.flying) {
                console.log('flying');
                this.velocity.z = 0;
                this.flying = true;
            }
        }
    }

    this.keys[keyCode] = down;

    switch(keyCode) {
        // F1
        case KEY.F1: {
            if(!down) {
                Game.hud.toggleActive();
            }
            return true;
            break;
        }
        // F2 (Save)
        case KEY.F2: {
            if(!down) {
                Game.world.saveToDB();
                this.chat.messages.addSystem('Saved ... OK');
            }
            return true;
            break;
        }
        // F3 (Set spawnpoint)
        case KEY.F3: {
            if(!down) {
                Game.hud.draw_info = !Game.hud.draw_info;
            }
            return true;
            break;
        }
        // F4 (Draw all blocks)
        case KEY.F4: {
            if(!down) {
                if(e.shiftKey) {
                    var z = Math.round(Game.player.pos.z);
                    var x, startx = Math.round(Game.player.pos.x);
                    var y = Math.round(Game.player.pos.y);
                    var d = 10;
                    var cnt = 0;
                    for(var i = 0; i < Game.player.inventory.all.length; i++) {
                        if(Game.player.inventory.all[i].fluid) {
                            continue;
                        }
                        if(cnt % d == 0) {
                            x = startx;
                            y = y - 2;
                        }
                        x = x - 2;
                        Game.player.inventory.select(i);
                        Game.world.setBlock(x, y, z, Game.player.inventory.all[i]);
                        cnt++;
                    }
                } else {
                    var np = this.pos;
                    Game.world.spawnPoint = new Vector(np.x, np.y, np.z);
                    console.log('Spawnpoint changed');
                    this.chat.messages.addSystem('Spawnpoint changed');
                }
            }
            return true;
            break;
        }
        // F7 (Export world)
        case KEY.F7: {
            if(!down) {
                if(e.shiftKey) {
                    Game.world.createClone();
                } else {
                    Game.world.exportJSON();
                }
            }
            return true;
            break;
        }
        // F8 (Random teleport)
        case KEY.F8: {
            if(!down) {
                Game.world.randomTeleport();
            }
            return true;
            break;
        }
        // F9 (toggleNight | Under rain)
        case KEY.F9: {
            if(!down) {
                // Game.world.underWaterfall();
                Game.world.renderer.toggleNight();
            }
            return true;
            break;
        }
        // F10 (toggleUpdateChunks)
        case KEY.F10: {
            if(!down) {
                Game.world.chunkManager.toggleUpdateChunks();
            }
            return true;
            break;
        }
        // R (Respawn)
        case KEY.R: {
            if(!down) {
                this.pos.x = Game.world.spawnPoint.x;
                this.pos.y = Game.world.spawnPoint.y;
                this.pos.z = Game.world.spawnPoint.z;
            }
            return true;
            break;
        }
        // E (Inventory)
        case KEY.E: {
            if(!down) {
                if(Game.hud.wm.getVisibleWindows().length == 0) {
                    Game.hud.wm.getWindow('frmInventory').toggleVisibility();
                    return true;
                }
            }
            break;
        }
        // T (Open chat)
        case KEY.T: {
            if(!down) {
                if(!this.chat.active) {
                    this.chat.open([]);
                }
            }
            return true;
            break;
        }
        case KEY.SLASH: {
            if(!down) {
                if(!this.chat.active) {
                    this.chat.open(['/']);
                }
            }
            break;
        }
        case KEY.ENTER: {
            if(!down) {
                this.chat.submit();
            }
            break;
        }
        /*
        default: {
            if(!down) {
                if(this.chat.active) {
                    this.chat.keyPress(keyCode);
                    return;
                }
            }
            break;
        }*/
    }
    // 0...9 (Select material)
    if(!down && (keyCode >= 48 && keyCode <= 57)) {
        if(keyCode == 48) {
            keyCode = 58;
        }
        Game.inventory.select(keyCode - 49);
        return true;
    }
    // running
    // w = 87 // up
    // d = 68 // right
    // a = 65 // left
    // s = 83 // down
    if(keyCode == KEY.S) {this.moving = down || this.keys[KEY.A] || this.keys[KEY.D] || this.keys[KEY.S] || this.keys[KEY.W];}
    if(keyCode == KEY.D) {this.moving = down || this.keys[KEY.A] || this.keys[KEY.D] || this.keys[KEY.S] || this.keys[KEY.W];}
    if(keyCode == KEY.A) {this.moving = down || this.keys[KEY.A] || this.keys[KEY.D] || this.keys[KEY.S] || this.keys[KEY.W];}  
    if(keyCode == KEY.W) {
        const n = performance.now();
        if(down) {
            this.moving = true;
            if(n - this.previousForwardDown < 250 && n - this.previousForwardUp < 250) {
                this.running = true;
                // Game.render.fov = 90; // setPerspective(85, 0.01, RENDER_DISTANCE);
            }
            this.previousForwardDown = n;
        } else {
            this.moving = false;
            this.running = false;
            this.previousForwardUp = n;
        }
    }
    if(e.ctrlKey) {
        if(this.keys[KEY.W]) {
            this.running = true;
        } else {
            this.running = false;
        }
    } else {
        if(!down) {
            if(keyCode == KEY.W) {
                this.running = false;
            }
        }
    }
    return false;
}

// Hook for mouse input.
Player.prototype.onMouseEvent = function(e, x, y, type, button_id, shiftKey) {
    var visibleWindows = Game.hud.wm.getVisibleWindows();
    if(visibleWindows.length > 0) {
        if (type == MOUSE.DOWN) {
            Game.hud.wm.mouseEventDispatcher({
                type:       e.type,
                shiftKey:   e.shiftKey,
                button:     e.button,
                offsetX:    Game.mouseX * (Game.hud.width / Game.world.renderer.canvas.width),
                offsetY:    Game.mouseY * (Game.hud.height / Game.world.renderer.canvas.height)
            });
            return false;
        }
    }
    if(!Game.controls.enabled || this.chat.active || visibleWindows.length > 0) {
        return false
    }
    x = Game.render.gl.canvas.width * 0.5;
    y = Game.render.gl.canvas.height * 0.5;
    if (type == MOUSE.DOWN) {
        this.doBlockAction(button_id, shiftKey);
    }
}

// Called to perform an action based on the player's block selection and input.
Player.prototype.doBlockAction = function(button_id, shiftKey) {
    var that            = this;
    var destroyBlock    = button_id == 1;
    var cloneBlock      = button_id == 2;
    var createBlock     = button_id == 3;
    var world           = this.world; // this.client ? this.client : this.world;
    const playerRotate  = Game.world.rotateDegree;
	this.canvas.renderer.pickAt.get(function(block) {
        if(block != false) {
            var world_block = that.world.chunkManager.getBlock(block.x, block.y, block.z);
            var playerPos = that.getBlockPos();
            if(createBlock) {
                if([BLOCK.CRAFTING_TABLE.id, BLOCK.CHEST.id, BLOCK.FURNACE.id, BLOCK.BURNING_FURNACE.id].indexOf(world_block.id) >= 0) {
                    if(!shiftKey) {
                        switch(world_block.id) {
                            case BLOCK.CRAFTING_TABLE.id: {
                                Game.hud.wm.getWindow('ct1').toggleVisibility();
                                break;
                            }
                            case BLOCK.CHEST.id: {
                                Game.hud.wm.getWindow('frmChest').load(world_block);
                                break;
                            }
                        }
                        return;
                    }
                }
                if(playerPos.x == block.x && playerPos.y == block.y && (playerPos.z - 1 == block.z || playerPos.z == block.z )) {
                    // block is occupied by player
                    return;
                }
                if(!that.buildMaterial || that.inventory.getCurrent().count < 1) {
                    return;
                }
                var matBlock = BLOCK.fromId(that.buildMaterial.id);
                if(world_block && (world_block.fluid || world_block.id == BLOCK.GRASS.id)) {
                    // Replace block
                    if(playerPos.x == block.x && playerPos.y == block.y && playerPos.z == block.z) {
                        // block is occupied by player
                        return;
                    }
                    if(matBlock.is_item || matBlock.is_entity) {
                        if(matBlock.is_entity) {
                            Game.world.server.CreateEntity(matBlock.id, new Vector(block.x + block.n.x, block.y + block.n.y, block.z + block.n.z), playerRotate);
                        }
                    } else {
                        world.setBlock(block.x, block.y, block.z, that.buildMaterial, null, playerRotate);
                    }
                } else {
                    // Create block
                    var blockUnder = that.world.chunkManager.getBlock(block.x + block.n.x, block.y + block.n.y, block.z + block.n.z - 1);
                    if(BLOCK.isPlants(that.buildMaterial.id) && blockUnder.id != BLOCK.DIRT.id) {
                        return;
                    }
                    if(matBlock.is_item || matBlock.is_entity) {
                        if(matBlock.is_entity) {
                            Game.world.server.CreateEntity(matBlock.id, new Vector(block.x + block.n.x, block.y + block.n.y, block.z + block.n.z), playerRotate);
                        }
                    } else {
                        if(['ladder'].indexOf(that.buildMaterial.style) >= 0) {
                            if(block.n.z != 0 || world_block.transparent) {
                                return;
                            }
                        }
                        world.setBlock(block.x + block.n.x, block.y + block.n.y, block.z + block.n.z, that.buildMaterial, null, playerRotate);
                    }
                }
                that.inventory.decrement();
            } else if(destroyBlock) {
                // Destroy block
                if(world_block.id != BLOCK.BEDROCK.id && world_block.id != BLOCK.STILL_WATER.id) {
                    world.chunkManager.destroyBlock(block, true);
                    if(world_block.id == BLOCK.CONCRETE.id) {
                        world_block = BLOCK.fromId(BLOCK.COBBLESTONE.id);
                    }
                    if(world_block.id != BLOCK.GRASS.id) {
                        that.inventory.increment(Object.assign({count: 1}, world_block));
                    }
                    var block_over = that.world.chunkManager.getBlock(block.x, block.y, block.z + 1);
                    // delete plant over deleted block
                    if(BLOCK.isPlants(block_over.id)) {
                        block.z++;
                        world.chunkManager.destroyBlock(block, true);
                    }
                }
            } else if(cloneBlock) {
                if(world_block) {
                    that.inventory.cloneMaterial(world_block);
                }
            }
        }
    });
}

// Returns the position of the eyes of the player for rendering.
Player.prototype.getEyePos = function() {
	return this.pos.add(new Vector(0.0, 0.0, PLAYER_HEIGHT));
}

// getBlockPos
Player.prototype.getBlockPos = function() {
    var v = new Vector(
        parseInt(this.pos.x),
        parseInt(this.pos.y),
        parseInt(this.pos.z)
    );
    if(this.pos.x < 0) {
        v.x--;
    }
    if(this.pos.y < 0) {
        v.y--;
    }
    return v;
}

// Updates this local player (gravity, movement)
Player.prototype.update = function() {
	var world     = this.world;
	var velocity  = this.velocity;
	var pos       = this.pos;
	var bPos      = new Vector(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
	if(this.lastUpdate != null) {
        // var delta = ( new Date().getTime() - this.lastUpdate ) / 1000;
		var delta = (performance.now() - this.lastUpdate) / 1000;
        // View
        this.angles[0] = parseInt(this.world.rotateRadians.x * 100000) / 100000; // pitch | вверх-вниз (X)
        this.angles[1] = parseInt(this.world.rotateRadians.y * 100000) / 100000; // yaw | влево-вправо (Y)
        // this.angles[2] = deg2rad(45); // roll | Наклон
		// Gravity
		if(this.falling && !this.flying) {
            var vz = -(30 * delta);
			velocity.z += vz;
        }
        // Jumping | flying
        if(this.keys[KEY.SPACE]) {
            if(this.falling) {
                if(this.flying) {
                    velocity.z = 8;
                }
            } else {
                velocity.z = 8;
            }
        } else {
            if(this.flying) {
                var vz = -(15 * delta);
                velocity.z += vz;
                if(velocity.z < 0) {
                    velocity.z = 0;
                }
            }
        }
        if(this.keys[KEY.SHIFT]) {
            if(this.flying) {
                velocity.z = -8;
            }
        }
		if(this.keys[KEY.J] && !this.falling) {
			velocity.z = 20;
        }
        if(Math.round(velocity.x * 100000) / 100000 == 0) velocity.x = 0;
        if(Math.round(velocity.y * 100000) / 100000 == 0) velocity.y = 0;
        if(Math.round(velocity.z * 100000) / 100000 == 0) velocity.z = 0;
        this.walking = (Math.abs(velocity.x) > 1 || Math.abs(velocity.y) > 1) && !this.flying;
        if(this.prev_walking != this.walking) {
            // @toggle walking
            // this.walking_frame = 0;
        }
        if(this.walking) {
            this.walking_frame += delta;
            // console.log('this.walking_frame', Math.round(this.walking_frame * 1000) / 1000);
        } else {
            /*if(this.walking_frame != 0) {
                this.walking_frame += delta;
                if(Math.round(Math.cos(this.walking_frame * 15) * 100) / 100 == 0) {
                    this.walking_frame = 0;
                }
            }*/
        }
        this.prev_walking = this.walking;
		// Walking
		var walkVelocity = new Vector(0, 0, 0);
		if (!this.falling || this.flying) {
			if(this.keys[KEY.W] && !this.keys[KEY.S]) {
				walkVelocity.x += Math.cos(Math.PI / 2 - this.angles[1]);
				walkVelocity.y += Math.sin(Math.PI / 2 - this.angles[1]);
			}
            if(this.keys[KEY.S] && !this.keys[KEY.W]) {
				walkVelocity.x += Math.cos(Math.PI + Math.PI / 2 - this.angles[1]);
				walkVelocity.y += Math.sin(Math.PI + Math.PI / 2 - this.angles[1]);
			}
			if(this.keys[KEY.A] && !this.keys[KEY.D]) {
				walkVelocity.x += Math.cos(Math.PI / 2 + Math.PI / 2 - this.angles[1]);
				walkVelocity.y += Math.sin(Math.PI / 2 + Math.PI / 2 - this.angles[1]);
			}
            if(this.keys[KEY.D] && !this.keys[KEY.A]) {
				walkVelocity.x += Math.cos(-Math.PI / 2 + Math.PI / 2 - this.angles[1]);
				walkVelocity.y += Math.sin(-Math.PI / 2 + Math.PI / 2 - this.angles[1]);
			}
		}
        if(this.running) {
            if(Game.render.fov < FOV_WIDE) {
                var fov = Math.min(Game.render.fov + FOV_CHANGE_SPEED * delta, FOV_WIDE);
                Game.render.setPerspective(fov, 0.01, RENDER_DISTANCE);
            }
        } else {
            if(Game.render.fov > FOV_NORMAL) {
                var fov = Math.max(Game.render.fov - FOV_CHANGE_SPEED * delta, FOV_NORMAL);
                Game.render.setPerspective(fov, 0.01, RENDER_DISTANCE);
            }
        }
		if(walkVelocity.length() > 0) {
            var mul = 1; // this.flying ? 1 : 1;
            if(this.running) {
                mul *= 1.5;
                if(this.flying) {
                    mul *= 1.5;
                }
            }
			walkVelocity = walkVelocity.normal();
			velocity.x = walkVelocity.x * 4 * mul;
			velocity.y = walkVelocity.y * 4 * mul;
		} else {
			velocity.x /= this.falling ? 1.01 : 1.5;
			velocity.y /= this.falling ? 1.01 : 1.5;
		}
		// Resolve collision
		this.pos = this.resolveCollision(pos, bPos, velocity.mul(delta));
        this.pos.x = Math.round(this.pos.x * 1000) / 1000;
        this.pos.y = Math.round(this.pos.y * 1000) / 1000;
        this.pos.z = Math.round(this.pos.z * 1000) / 1000;
        // this.pos.z = 100; // Math.min(this.pos.z, 80);
        //
        var playerBlockPos  = Game.world.localPlayer.getBlockPos();
        var chunkPos        = Game.world.chunkManager.getChunkPos(playerBlockPos.x, playerBlockPos.y, playerBlockPos.z);
        this.overChunk      = Game.world.chunkManager.getChunk(chunkPos);
	}
	this.lastUpdate = performance.now(); // new Date().getTime();
}

// Resolves collisions between the player and blocks on XY level for the next movement step.
Player.prototype.resolveCollision = function(pos, bPos, velocity) {
	var world = this.world;
	var playerRect = {x: pos.x + velocity.x, y: pos.y + velocity.y, size: 0.25};
    const shiftPressed = this.keys[KEY.SHIFT];
	// Collect XY collision sides
	var collisionCandidates = [];
	for(var x = bPos.x - 1; x <= bPos.x + 1; x++) {
		for(var y = bPos.y - 1; y <= bPos.y + 1; y++) {
			for(var z = bPos.z; z <= bPos.z + 1; z++) {
                var block = world.chunkManager.getBlock(x, y, z);
				if (!block.passable) {
					if (world.chunkManager.getBlock( x - 1, y, z ).passable) collisionCandidates.push({x: x, dir: -1, y1: y, y2: y + 1});
					if (world.chunkManager.getBlock( x + 1, y, z ).passable) collisionCandidates.push({x: x + 1, dir: 1, y1: y, y2: y + 1});
					if (world.chunkManager.getBlock( x, y - 1, z ).passable) collisionCandidates.push({y: y, dir: -1, x1: x, x2: x + 1 });
					if (world.chunkManager.getBlock( x, y + 1, z ).passable) collisionCandidates.push({y: y + 1, dir: 1, x1: x, x2: x + 1 });
				}
			}
            /*
            if(shiftPressed) {
                var z = bPos.z - 1;
                if (world.chunkManager.getBlock( x - 1, y, z ).passable) {
                    // world.setBlock( x - 1, y, z, BLOCK.WOOD );
                    collisionCandidates.push({x: x, dir: -1, y1: y, y2: y + 1});
                }
                if (world.chunkManager.getBlock( x + 1, y, z ).passable) {
                    // world.setBlock( x + 1, y, z, BLOCK.WOOD );
                    collisionCandidates.push({x: x + 1, dir: 1, y1: y, y2: y + 1});
                }
                if (world.chunkManager.getBlock( x, y - 1, z ).passable) {
                    // world.setBlock( x, y - 1, z, BLOCK.WOOD );
                    collisionCandidates.push({y: y, dir: -1, x1: x, x2: x + 1 });
                }
                if (world.chunkManager.getBlock( x, y + 1, z ).passable) {
                    // world.setBlock( x, y + 1, z, BLOCK.WOOD );
                    collisionCandidates.push({y: y + 1, dir: 1, x1: x, x2: x + 1 });
                }
            }
            */
		}
	}
	// Solve XY collisions
	for(var i in collisionCandidates)  {
		var side = collisionCandidates[i];
		if (lineRectCollide(side, playerRect)) {
			if(side.x != null && velocity.x * side.dir < 0) {
				pos.x = side.x + playerRect.size / 2 * ( velocity.x > 0 ? -1 : 1 );
				velocity.x = 0;
			} else if(side.y != null && velocity.y * side.dir < 0) {
				pos.y = side.y + playerRect.size / 2 * ( velocity.y > 0 ? -1 : 1 );
				velocity.y = 0;
			}
		}
	}
	var playerFace = { x1: pos.x + velocity.x - 0.125, y1: pos.y + velocity.y - 0.125, x2: pos.x + velocity.x + 0.125, y2: pos.y + velocity.y + 0.125 };
	var newBZLower = Math.floor( pos.z + velocity.z );
	var newBZUpper = Math.floor( pos.z + 1.7 + velocity.z * 1.1 );
	// Collect Z collision sides
	collisionCandidates = [];
	for(var x = bPos.x - 1; x <= bPos.x + 1; x++) {
		for(var y = bPos.y - 1; y <= bPos.y + 1; y++) {
			if (!world.chunkManager.getBlock( x, y, newBZLower ).passable)
				collisionCandidates.push( { z: newBZLower + 1, dir: 1, x1: x, y1: y, x2: x + 1, y2: y + 1 } );
			if (!world.chunkManager.getBlock( x, y, newBZUpper ).passable)
				collisionCandidates.push( { z: newBZUpper, dir: -1, x1: x, y1: y, x2: x + 1, y2: y + 1 } );
		}
	}
	// Solve Z collisions
	var falling = true;
	for(var i in collisionCandidates) {
		var face = collisionCandidates[i];
		if (rectRectCollide(face, playerFace) && velocity.z * face.dir < 0) {
			if(velocity.z < 0) {
				falling         = false;
				pos.z           = face.z;
				velocity.z      = 0;
				this.velocity.z = 0;
			} else {
				pos.z           = face.z - 1.8;
				velocity.z      = 0;
				this.velocity.z = 0;
			}
			break;
		}
    }
    this.falling = falling;
    if(!falling && this.flying) {
        this.flying = false;
    }
	// Return solution
	return pos.add(velocity);
}