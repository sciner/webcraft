/* World container
*
* This class contains the elements that make up the game world.
* Other modules retrieve information from the world or alter it
* using this class.
*/
function World(saved_state, connectedCallback) {

    var that = this;

    var serverURL = Helpers.isDev() ? 'ws://127.0.0.1:5700/ws' : 'wss://go.madcraft.io/ws';

    // Create server client
    that.server = new ServerClient(serverURL, function() {
        that.server.Send({name: ServerClient.EVENT_CONNECT, data: {id: saved_state._id, seed: saved_state.seed + ''}});
        that.players        = [];
        that.rainTim        = null;
        that.saved_state    = saved_state;
        that.seed           = saved_state.seed;
        that.chunkManager   = new ChunkManager(that);
        that.rotateRadians  = new Vector(0, 0, 0);
        that.rotateDegree   = new Vector(0, 0, 0);
        //
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
                for(let key of Object.keys(this.list)) {
                    let mesh = this.list[key];
                    if(mesh.isAlive()) {
                        mesh.draw(render, delta, modelMatrix, uModelMat);
                    } else {
                        this.remove(key, render)
                    }
                }
            }
        };
        that.rotate         = new Vector(saved_state.rotate.x, saved_state.rotate.y, saved_state.rotate.z);
        that.spawnPoint     = new Vector(saved_state.spawnPoint.x, saved_state.spawnPoint.y, saved_state.spawnPoint.z);
        if(saved_state.hasOwnProperty('chunk_render_dist')) {
            that.chunkManager.setRenderDist(saved_state.chunk_render_dist);
        }
        connectedCallback();
    });

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
    this.meshes.add(new Particles_Block_Destroy(this.renderer.gl, block, pos));
}

// rainDrop
World.prototype.rainDrop = function(pos) {
    this.meshes.add(new Particles_Raindrop(this.renderer.gl, pos));
}

// setRain
World.prototype.setRain = function(value) {
    if(value) {
        if(!this.rainTim) {
            this.rainTim = setInterval(function(){
                var pos = Game.world.localPlayer.pos;
                Game.world.rainDrop(new Vector(pos.x, pos.y + 20, pos.z));
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
    this.localPlayer.pos.y = 80;
    this.localPlayer.pos.z = 10 + Math.random() * 2000000
}

// underWaterfall
World.prototype.underWaterfall = function() {
    this.setBlock(parseInt(this.localPlayer.pos.x), CHUNK_SIZE_Y - 1, parseInt(this.localPlayer.pos.z), BLOCK.FLOWING_WATER, 1);
}

World.prototype.addRotate = function(vec3) {
    const speed     = 1.0;
    this.rotate.x   -= vec3.x; // взгляд вверх/вниз (pitch)
    this.rotate.z   += vec3.z * speed; // Z поворот в стороны (yaw)
    this.fixRotate();
}

World.prototype.fixRotate = function() {
    // var halfYaw = (Game.render.canvas.width || window.innerWidth) * 0.5;
    var halfPitch = (Game.render.canvas.height || window.innerHeight) * 0.5;
    if(this.rotate.z <= -1800) {
        this.rotate.z = 1799.9;
    }
    if(this.rotate.z >= 1800) {
        this.rotate.z = -1800;
    }
    //
    this.rotate.x = Math.max(this.rotate.x, -halfPitch);
    this.rotate.x = Math.min(this.rotate.x, halfPitch);
    var x = (this.rotate.x / halfPitch) * 90;
    var y = 0;
    var z = this.rotate.z / 10;
    this.rotateRadians.x = Helpers.deg2rad(x);
    this.rotateRadians.y = Helpers.deg2rad(y);
    this.rotateRadians.z = Helpers.deg2rad(z);
    this.rotateDegree.x = Helpers.rad2deg(this.rotateRadians.x);
    this.rotateDegree.y = Helpers.rad2deg(this.rotateRadians.y);
    this.rotateDegree.z = Helpers.rad2deg(this.rotateRadians.z) + 180;
}

// update
World.prototype.update = function() {
    if(Game.world.localPlayer) {
        var pos = Game.world.localPlayer.pos;
        if(Math.abs(pos.x - Game.shift.x) > MAX_DIST_FOR_SHIFT || Math.abs(pos.z - Game.shift.z) > MAX_DIST_FOR_SHIFT) {
            Game.shift.x    = pos.x;
            Game.shift.z    = pos.z;
            var tm          = performance.now();
            var points      = this.chunkManager.shift(Object.assign({}, Game.shift));
            console.info('SHIFTED', Game.shift, (Math.round((performance.now() - tm) * 10) / 10) + 'ms', points);
        }
    }
    this.chunkManager.update();
}

// exportJSON
World.prototype.exportJSON = function(callback) {
    var that = this;
    var row = {
        _id:                Game.world_name,
        seed:               Game.seed,
        spawnPoint:         that.spawnPoint,
        pos:                that.localPlayer.pos,
        flying:             that.localPlayer.flying,
        chunk_render_dist:  CHUNK_RENDER_DIST,
        rotate:             that.rotate,
        brightness:         that.renderer.brightness,
        inventory:  {
            items: Game.world.localPlayer.inventory.items,
            current: {
                index: Game.world.localPlayer.inventory.index
            }
        }
    };
    if(callback) {
        callback(row);
    } else {
        Helpers.saveJSON(row, Game.world_name + '.json');
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