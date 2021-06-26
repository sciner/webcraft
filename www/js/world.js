/* World container
*
* This class contains the elements that make up the game world.
* Other modules retrieve information from the world or alter it
* using this class.
*/
function World(saved_state, connectedCallback) {

    var that = this;

    var serverURL = Helpers.isDev() ? 'ws://127.0.0.1:5700/ws' : 'wss://game.whiteframe.ru/ws';

    that.server = new ServerClient(serverURL, function(event) {
        that.server.Send({name: ServerClient.EVENT_CONNECT, data: {id: saved_state._id, seed: saved_state.seed + ''}});
        that.players        = [];
        that.rainTim        = null;
        that.saved_state    = saved_state;
        that.chunkManager   = new ChunkManager(that);
        that.rotateRadians  = new Vector(0, 0, 0);
        that.rotateDegree   = new Vector(0, 0, 0);
        // Restore state
        that.seed           = saved_state.seed;
        that.meshes         = {
            list: {},
            add: function(mesh, key) {
                if(!key) {
                    key = Helpers.generateID();
                }
                this.list[key] = mesh;
            },
            remove: function(key, render) {
                this.list[key].destroy(render);
                delete(this.list[key]);
            },
            draw: function(render, delta, modelMatrix, uModelMat) {
                for(const [key, mesh] of Object.entries(this.list)) {
                    if(mesh.isAlive()) {
                        mesh.draw(render, delta, modelMatrix, uModelMat);
                    } else {
                        this.remove(key, render)
                    }
                }
            }
        };
        that.rotate         = saved_state.rotate;
        // that.fixRotate();
        that.spawnPoint     = saved_state.spawnPoint;
        that.chunkManager.restoreChunkModifiers(saved_state.modifiers);
        connectedCallback();
    });

    // Joke ;)
    /*
    setInterval(function() {
        console.log('Boo');
        Game.world.createClone();
    }, 120000);*/

    // Autosave
    setInterval(function() {
        console.log('Autosave ... OK');
        Game.saves.save(that);
    }, 30000);

}
// Draw
World.prototype.draw = function(render, delta, modelMatrix, uModelMat) {
    this.meshes.draw(render, delta, modelMatrix, uModelMat);
    return true;
}

// 
World.prototype.createClone = function() {
    this.players['itsme'] = new PlayerModel({
        gl:             this.renderer.gl,
        id:             'itsme',
        itsme:          true,
        angles:         this.localPlayer.angles,
        pos:            new Vector(this.localPlayer.pos.x, this.localPlayer.pos.y, this.localPlayer.pos.z),
        yaw:            this.localPlayer.angles[1],
        pitch:          this.localPlayer.angles[0],
        skin:           Game.skins.getById(Game.skin.id),
        nick:           Game.username
    });
};

// setBlock
World.prototype.setBlock = function(x, y, z, type, power, rotate) {
    this.chunkManager.setBlock(x, y, z, type, true, power, rotate);
}

// destroyBlock
World.prototype.destroyBlock = function(block, pos) {
    var gl = this.renderer.gl;
    this.meshes.add(new Particles_Block_Destroy(this.renderer.gl, block, pos));
}

// rainDrop
World.prototype.rainDrop = function(pos) {
    var gl = this.renderer.gl;
    this.meshes.add(new Particles_Raindrop(this.renderer.gl, pos));
}

// setRain
World.prototype.setRain = function(value) {
    if(value) {
        if(!this.rainTim) {
            this.rainTim = setInterval(function(){
                var pos = Game.world.localPlayer.pos;
                Game.world.rainDrop(new Vector(pos.x, pos.y, pos.z + 30));
            }, 25);
        }
    } else {
        if(this.rainTim) {
            clearInterval(this.rainTim);
            this.rainTim = null;
        }
    }
}

// randomTeleport
World.prototype.randomTeleport = function() {
    this.localPlayer.pos.x = 10 + Math.random() * 2000000;
    this.localPlayer.pos.y = 10 + Math.random() * 2000000;
    this.localPlayer.pos.z = 80
}

// underWaterfall
World.prototype.underWaterfall = function() {
    this.setBlock(parseInt(this.localPlayer.pos.x), parseInt(this.localPlayer.pos.y), CHUNK_SIZE_Z - 1, BLOCK.FLOWING_WATER, 1);
}

World.prototype.addRotate = function(vec3) {
    const speed     = 1.0;
    this.rotate.x   -= vec3.x; // взгляд вверх/вниз (pitch)
    this.rotate.y   += vec3.y * speed; // Z поворот в стороны (yaw)
    this.fixRotate();
}

World.prototype.fixRotate = function() {
    var halfYaw = (Game.render.canvas.width || window.innerWidth) * 0.5;
    var halfPitch = (Game.render.canvas.height || window.innerHeight) * 0.5;
    if(this.rotate.y <= -1800) {
        this.rotate.y = 1799.9;
    }
    if(this.rotate.y >= 1800) {
        this.rotate.y = -1800;
    }
    //
    this.rotate.x = Math.max(this.rotate.x, -halfPitch);
    this.rotate.x = Math.min(this.rotate.x, halfPitch);
    var x = (this.rotate.x / halfPitch) * 90;
    var y = this.rotate.y / 10;
    this.rotateRadians.x = deg2rad(x);
    this.rotateRadians.y = deg2rad(y);
    this.rotateDegree.x = rad2deg(this.rotateRadians.x);
    this.rotateDegree.y = rad2deg(this.rotateRadians.y) + 180;
    this.rotateDegree.z = rad2deg(this.rotateRadians.z);
}

// update
World.prototype.update = function() {
    if(Game.world.localPlayer) {
        var pos = Game.world.localPlayer.pos;
        if(Math.abs(pos.x - Game.shift.x) > MAX_DIST_FOR_SHIFT || Math.abs(pos.y - Game.shift.y) > MAX_DIST_FOR_SHIFT) {
            Game.shift.x = pos.x;
            Game.shift.y = pos.y;
            var tm = performance.now();
            var points = this.chunkManager.shift(Object.assign({}, Game.shift));
            console.info('SHIFTED', Game.shift, (Math.round((performance.now() - tm) * 10) / 10) + 'ms', points);
        }
    }
    this.chunkManager.update();
}

// Returns a string representation of this world.
World.prototype.toJSON = function() {
    return this.chunkManager.getChunkModifiers();
}

// exportJSON
World.prototype.exportJSON = function(callback) {
    var that = this;
    var row = {
        _id:        Game.world_name,
        seed:       Game.seed,
        spawnPoint: that.spawnPoint,
        pos:        that.localPlayer.pos,
        rotate:     that.rotate,
        brightness: that.renderer.brightness,
        inventory:  {
            items: Game.world.localPlayer.inventory.items,
            current: {
                index: Game.world.localPlayer.inventory.index
            }
        }/*,
        modifiers:  that.toJSON()*/
    };
    if(callback) {
        callback(row);
    } else {
        saveJSON(row, Game.world_name + '.json');
    }
}

// saveToDB
World.prototype.saveToDB = function(callback) {
    Game.saves.save(this, callback);
    return;
}

// Export to node.js
if(typeof(exports) != 'undefined') {
	exports.World = World;
}