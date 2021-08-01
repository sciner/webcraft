var CHUNK_RENDER_DIST   = 7; // 0(1chunk), 1(9), 2(25chunks), 3(45), 4(69), 5(109), 6(145), 7(193), 8(249) 9(305) 10(373) 11(437) 12(517)

//
function ChunkManager(world) {
    var that                    = this;
    this.chunks                 = {};
    this.chunks_prepare         = {};
    this.modify_list            = {};
    this.world                  = world;
    this.margin                 = Math.max(CHUNK_RENDER_DIST + 1, 1);
    this.rendered_chunks        = {fact: 0, total: 0};
    this.update_chunks          = true;
    this.vertices_length_total  = 0;
    this.worker                 = new Worker('./js/chunk_worker.js');
    // Message received from worker
    this.worker.onmessage = function(e) {
        const cmd = e.data[0];
        const args = e.data[1];
        switch(cmd) {
            case 'blocks_generated': {
                if(that.chunks.hasOwnProperty(args.key)) {
                    that.chunks[args.key].onBlocksGenerated(args);
                }
                break;
            }
            case 'vertices_generated': {
                // console.log('%c vertices_generated ' + args.key + ' ', 'background: #222; color: #bada55');
                if(that.chunks.hasOwnProperty(args.key)) {
                    that.chunks[args.key].onVerticesGenerated(args);
                }
                break;
            }
            case 'vertices_generated_many': {
                for(var result of args) {
                    if(that.chunks.hasOwnProperty(result.key)) {
                        that.chunks[result.key].onVerticesGenerated(result);
                    }
                }
                break;
            }
        }
    }
}

//
ChunkManager.prototype.setRenderDist = function(value) {
    value = Math.max(value, 4);
    value = Math.min(value, 50);
    CHUNK_RENDER_DIST = value;
    this.margin = Math.max(CHUNK_RENDER_DIST + 1, 1)
}

// toggleUpdateChunks
ChunkManager.prototype.toggleUpdateChunks = function() {
    this.update_chunks = !this.update_chunks;
}

// shift
ChunkManager.prototype.shift = function(shift) {
    const renderer = this.world.renderer
    const gl = renderer.gl;
    gl.useProgram(renderer.program);
    var points = 0;
    for(const [key, chunk] of Object.entries(this.chunks)) {
        points += chunk.doShift(shift);
    }
    return points;
}

// refresh
ChunkManager.prototype.refresh = function() {
}

// Draw level chunks
ChunkManager.prototype.draw = function(render) {
    var gl = render.gl;
    this.rendered_chunks.total  = Object.entries(this.chunks).length;
    this.rendered_chunks.fact   = 0;
    var applyVerticesCan        = 1;
    var a_pos                   = new Vector(0, 0, 0);
    // Для отрисовки чанков по спирали от центрального вокруг игрока
    this.spiral_moves = this.createSpiralCoords(this.margin * 2);
    // чанк, в котором стоит игрок
    var overChunk = Game.world.localPlayer.overChunk;
    // draw
    for(const transparent of [false, true]) {
        if(transparent) {
            gl.disable(gl.CULL_FACE);
        }
        if(overChunk) {
            for(var sm of this.spiral_moves) {
                var pos = new Vector(
                    overChunk.addr.x + sm.x - this.margin,
                    overChunk.addr.y + sm.y,
                    overChunk.addr.z + sm.z - this.margin
                );
                var chunk = this.getChunk(pos);
                if(chunk) {
                    if(chunk.hasOwnProperty('vertices_args')) {
                        if(applyVerticesCan-- > 0) {
                            chunk.applyVertices();
                        }
                    }
                    for(const [vkey, v] of Object.entries(chunk.vertices)) {
                        if(v.is_transparent == transparent) {
                            this.rendered_chunks.fact += 0.5;
                            render.drawBuffer(v.buffer, a_pos);
                        }
                    }
                }
            }
        }
        if(transparent) {
            gl.enable(gl.CULL_FACE);
        }
    }
    return true;
}

// Draw on HUD
ChunkManager.prototype.drawHUD = function(hud) {
    this.vertices_length_total = 0;
    for(const[key, chunk] of Object.entries(this.chunks)) {
        this.vertices_length_total += chunk.vertices_length;
    }
    Game.hud.text += '\nVertices: ' + this.vertices_length_total.toLocaleString(undefined, {minimumFractionDigits: 0});
}

// Get
ChunkManager.prototype.getChunk = function(pos) {
    var k = this.getPosChunkKey(pos);
    if(this.chunks.hasOwnProperty(k)) {
        return this.chunks[k];
    }
    return null;
}

// Add
ChunkManager.prototype.addChunk = function(pos) {
    var k = this.getPosChunkKey(pos);
    if(!this.chunks.hasOwnProperty(k) && !this.chunks_prepare.hasOwnProperty(k)) {
        this.chunks_prepare[k] = {
            start_time: performance.now()
        };
        this.world.server.ChunkAdd(pos);
        return true;
    }
    return false;
}

// Remove
ChunkManager.prototype.removeChunk = function(pos) {
    var k = this.getPosChunkKey(pos);
    this.chunks[k].destruct();
    delete this.chunks[k];
    this.world.server.ChunkRemove(pos);
}

// saveChunkModifiers
ChunkManager.prototype.saveChunkModifiers = function(pos, modify_list) {
    var k = this.getPosChunkKey(pos);
    this.modify_list[k] = modify_list;
}

// getChunkModifiers
ChunkManager.prototype.getChunkModifiers = function() {
    for(const [key, chunk] of Object.entries(this.chunks)) {
        var modifiers = chunk.getChunkModifiers();
        if(Object.entries(modifiers).length > 0) {
            this.modify_list[key] = modifiers;
        }
    }
    return this.modify_list;
}

// postWorkerMessage
ChunkManager.prototype.postWorkerMessage = function(data) {
    this.worker.postMessage(data);
};

// Установить начальное состояние указанного чанка
ChunkManager.prototype.setChunkState = function(state) {
    var k = this.getPosChunkKey(state.pos);
    if(this.chunks_prepare.hasOwnProperty(k)) {
        var prepare = this.chunks_prepare[k];
        var chunk = new Chunk(this, state.pos, state.modify_list);
        chunk.load_time = performance.now() - prepare.start_time;
        delete(this.chunks_prepare[k]);
        this.chunks[k] = chunk;
    }
}

// createSpiralMoves ...
ChunkManager.prototype.createSpiralCoords = function(size) {
    if(this.hasOwnProperty(size)) {
        return this[size];
    }
    var resp = [];
    var margin = this.margin;
    function rPush(vec) {
        // Если позиция на расстояние видимости (считаем честно, по кругу)
        var dist = Math.sqrt(Math.pow(vec.x - size / 2, 2) + Math.pow(vec.z - size / 2, 2));
        if(dist < margin) {
            resp.push(vec);
        }
    }
    var iInd = parseInt(size / 2);
    var jInd = parseInt(size / 2);
    var iStep = 1;
    var jStep = 1;
    rPush(new Vector(iInd, 0, jInd));
    for(var i = 0; i < size; i++) {
        for (var h = 0; h < i; h++) rPush(new Vector(iInd, 0, jInd += jStep));
        for (var v = 0; v < i; v++) rPush(new Vector(iInd += iStep, 0, jInd));
        jStep = -jStep;
        iStep = -iStep;
    }
    for(var h = 0; h < size - 1; h++) {
        rPush(new Vector(iInd, 0, jInd += jStep));
    }
    this[size] = resp;
    return resp;
}

// Update
ChunkManager.prototype.update = function() {
    if(!this.update_chunks) {
        return;
    }
    var world = this.world;
    var spiral_moves = this.createSpiralCoords(this.margin * 2);
    var chunkPos = this.getChunkPos(world.spawnPoint.x, world.spawnPoint.y, world.spawnPoint.z);
    if(world.localPlayer) {
        var chunkPos = this.getChunkPos(world.localPlayer.pos.x, world.localPlayer.pos.y, world.localPlayer.pos.z);
    }
    if(Object.entries(Game.world.chunkManager.chunks).length != spiral_moves.length || (this.prevChunkPos && this.prevChunkPos.distance(chunkPos) > 0)) {
        this.prevChunkPos = chunkPos;
        var actual_keys = {};
        var can_add = 3;
        for(const [key, chunk] of Object.entries(this.chunks)) {
            if(!chunk.inited) {
                can_add = 0;
                break;
            }
        }
        for(var sm of spiral_moves) {
            var pos = new Vector(
                chunkPos.x + sm.x - this.margin,
                chunkPos.y + sm.y,
                chunkPos.z + sm.z - this.margin
            );
            actual_keys[this.getPosChunkKey(pos)] = pos;
            if(can_add > 0) {
                if(this.addChunk(pos)) {
                    can_add--;
                }
            }
        }
        // check for remove
        for (const [key, value] of Object.entries(this.chunks)) {
            if(!actual_keys.hasOwnProperty(key)) {
                this.removeChunk(this.parseChunkPos(key));
            }
        }
    }
    // detect dirty chunks
    var dirty_chunks = [];
    for(const [key, chunk] of Object.entries(this.chunks)) {
        if(chunk.dirty && !chunk.buildVerticesInProgress) {
            if(
                this.getChunk(new Vector(chunk.addr.x - 1, chunk.addr.y, chunk.addr.z)) &&
                this.getChunk(new Vector(chunk.addr.x + 1, chunk.addr.y, chunk.addr.z)) &&
                this.getChunk(new Vector(chunk.addr.x, chunk.addr.y, chunk.addr.z - 1)) &&
                this.getChunk(new Vector(chunk.addr.x, chunk.addr.y, chunk.addr.z + 1))
               ) {
                dirty_chunks.push({
                    coord: chunk.coord,
                    key: chunk.key
                });
            }
        }
    }
    if(dirty_chunks.length > 0) {
        if(dirty_chunks.length == 2 || dirty_chunks.length == 3) {
            var keys = [];
            for(var dc of dirty_chunks) {
                this.chunks[dc.key].buildVerticesInProgress = true;
                keys.push(dc.key)
            }
            // Run webworker method
            this.postWorkerMessage(['buildVerticesMany', {keys: keys, shift: Game.shift}]);
        } else {
            // sort dirty chunks by dist from player
            dirty_chunks = MyArray.from(dirty_chunks).sortBy('coord');
            // rebuild dirty chunks
            var buildCount = 1;
            for(var dc of dirty_chunks) {
                if(this.chunks[dc.key].buildVertices()) {
                    if(--buildCount == 0) {
                        break;
                    }
                }
            }
        }
    }
}

ChunkManager.prototype.getPosChunkKey = function(pos) {
    var k = 'c_' + pos.x + '_' + pos.y + '_' + pos.z;
    return k;
}

ChunkManager.prototype.parseChunkPos = function(key) {
    var k = key.split('_');
    return new Vector(parseInt(k[1]), parseInt(k[2]), parseInt(k[3]));
}

// Возвращает относительные координаты чанка по глобальным абсолютным координатам
ChunkManager.prototype.getChunkPos = function(x, y, z) {
    var v = new Vector(
        parseInt(x / CHUNK_SIZE_X),
        0,
        parseInt(z / CHUNK_SIZE_Z)
    );
    if(x < 0) {v.x--;}
    if(z < 0) {v.z--;}
    if(v.x == 0) {v.x = 0;}
    if(v.y == 0) {v.y = 0;}
    if(v.z == 0) {v.z = 0;}
    return v;
}

// Возвращает блок по абслютным координатам
ChunkManager.prototype.getBlock = function(x, y, z) {
    // определяем относительные координаты чанка
    var chunkPos = this.getChunkPos(x, y, z);
    // обращаемся к чанку
    var chunk = this.getChunk(chunkPos);
    // если чанк найден
    if(chunk) {
        // просим вернуть блок передав абсолютные координаты
        return chunk.getBlock(x, y, z);
    }
    return BLOCK.DUMMY;
}

// setBlock
ChunkManager.prototype.setBlock = function(x, y, z, block, is_modify, power, rotate, entity_id) {
    // определяем относительные координаты чанка
    var chunkPos = this.getChunkPos(x, y, z);
    // обращаемся к чанку
    var chunk = this.getChunk(chunkPos);
    // если чанк найден
    if(!chunk) {
        return null;
    }
    var pos = new Vector(x, y, z);
    var item = {
        id: block.id,
        power: power ? power : 1.0,
        rotate: rotate,
        entity_id: entity_id
    };
    if(is_modify) {
        // @server
        this.world.server.Send({
            name: ServerClient.EVENT_BLOCK_SET,
            data: {
                pos: pos,
                item: item
            }
        });
    }
    if(is_modify) {
        var world_block = chunk.getBlock(pos.x, pos.y, pos.z);
        var b = null;
        var action = null;
        if(block.id == BLOCK.AIR.id) {
            // dig
            action = 'dig';
            b = world_block;
        } else {
            // place
            action = 'place';
            b = block;
        }
        b = BLOCK_BY_ID[b.id];
        if(b.hasOwnProperty('sound')) {
            Game.sounds.play(b.sound, action);
        }
    }
    // устанавливаем блок
    return chunk.setBlock(pos.x, pos.y, pos.z, block, false, item.power, item.rotate, item.entity_id);
}

// destroyBlock
ChunkManager.prototype.destroyBlock = function(pos, is_modify) {
    var block = this.getBlock(pos.x, pos.y, pos.z);
    if(block.id == BLOCK.TULIP.id) {
        this.world.renderer.setBrightness(.15);
    } else if(block.id == BLOCK.DANDELION.id) {
        this.world.renderer.setBrightness(1);
    } else if(block.id == BLOCK.CACTUS.id) {
        this.world.setRain(true);
    }
    /*
    // @server
    this.world.server.Send({
        name: ServerClient.EVENT_BLOCK_DESTROY,
        data: {
            pos: new Vector(x, y, z)
        }
    });
    */
    this.world.destroyBlock(block, pos);
    this.setBlock(pos.x, pos.y, pos.z, BLOCK.AIR, true);
}

// setDirty
ChunkManager.prototype.setDirty = function(pos) {
    var chunk = this.getChunk(pos);
    if(chunk) {
        chunk.dirty = true;
        // Run webworker method
        this.postWorkerMessage(['buildVertices', {
            shift: Game.shift,
            key: chunk.key
        }]);
    }
}

// setDirtySimple
ChunkManager.prototype.setDirtySimple = function(pos) {
    var chunk = this.getChunk(pos);
    if(chunk) {
        chunk.dirty = true;
    }
}