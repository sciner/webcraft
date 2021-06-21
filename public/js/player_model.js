"use strict";

function PlayerModel(props) {

    this.texPlayer                  = null;
    this.texPlayer2                 = null;
    this.moving_timeout             = null;
    this.texture                    = null;
    this.nametag                    = null;
    this.moving                     = false;
    this.aniframe                   = 0;
    this.height                     = 1.7;

    Object.assign(this, props);

    // Create canvas used to draw name tags
    this.textCanvas                 = document.createElement('canvas');
    this.textCanvas.width           = 256;
    this.textCanvas.height          = 64;
    this.textCanvas.style.display   = 'none';

    // Create context used to draw name tags
    this.textContext                = this.textCanvas.getContext('2d');
    this.textContext.textAlign      = 'left';
    this.textContext.textBaseline   = 'top';
    this.textContext.font           = '24px Minecraftia';

}

// draw
PlayerModel.prototype.draw = function(render, modelMatrix, uModelMat, camPos, options) {
    this.drawLayer(render, modelMatrix, uModelMat, camPos, {
        scale:          1.0,
        texture:        this.texPlayer,
        draw_nametag:   false
    });

    const gl = this.gl;
    gl.disable(gl.CULL_FACE);
    
    this.drawLayer(render, modelMatrix, uModelMat, camPos, {
        scale:          1.05,
        texture:        this.texPlayer2,
        draw_nametag:   true
    });

    gl.enable(gl.CULL_FACE);
    
}

// loadMesh...
PlayerModel.prototype.loadMesh = function() {
    this.loadPlayerHeadModel();
    this.loadPlayerBodyModel();
    this.loadTextures();
}

// loadTextures...
PlayerModel.prototype.loadTextures = function() {
    var that = this;
    var gl = this.gl;
    // Load player texture
    var image = new Image();
    image.onload = function() {
        Helpers.createSkinLayer2(null, image, function(file) {
            var image2 = new Image();
            image2.onload = function(e) {
                gl.useProgram(Game.world.renderer.program);
                // Layer1
                var texture = gl.createTexture();
                texture.image = image;
                that.texPlayer = texture;
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                // Layer2
                var texture2 = gl.createTexture();
                texture2.image = image2;
                that.texPlayer2 = texture2;
                gl.bindTexture(gl.TEXTURE_2D, texture2);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture2.image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                document.getElementsByTagName('body')[0].append(image2);
            };
            image2.src = URL.createObjectURL(file);
        });
    };
    image.src = this.skin.file;
}

// Loads the player head model into a vertex buffer for rendering.
PlayerModel.prototype.loadPlayerHeadModel = function() {

    var gl = this.gl;
    
    // Player head
    var vertices = [
        // Top
        -0.25, -0.25, 0.25, 8/64, 0, 1, 1, 1, 1,
        0.25, -0.25, 0.25, 16/64, 0, 1, 1, 1, 1,
        0.25, 0.25, 0.25, 16/64, 8/64, 1, 1, 1, 1,
        0.25, 0.25, 0.25, 16/64, 8/64, 1, 1, 1, 1,
        -0.25, 0.25, 0.25, 8/64, 8/64, 1, 1, 1, 1,
        -0.25, -0.25, 0.25, 8/64, 0, 1, 1, 1, 1,
        
        // Bottom
        -0.25, -0.25, -0.25, 16/64, 0, 1, 1, 1, 1,
        -0.25, 0.25, -0.25, 16/64, 8/64, 1, 1, 1, 1,
        0.25, 0.25, -0.25, 24/64, 8/64, 1, 1, 1, 1,
        0.25, 0.25, -0.25, 24/64, 8/64, 1, 1, 1, 1,
        0.25, -0.25, -0.25, 24/64, 0, 1, 1, 1, 1,
        -0.25, -0.25, -0.25, 16/64, 0, 1, 1, 1, 1,
        
        // Front        
        -0.25, -0.25, 0.25, 8/64, 8/64, 1, 1, 1, 1,
        -0.25, -0.25, -0.25, 8/64, 16/64, 1, 1, 1, 1,
        0.25, -0.25, -0.25, 16/64, 16/64, 1, 1, 1, 1,
        0.25, -0.25, -0.25, 16/64, 16/64, 1, 1, 1, 1,
        0.25, -0.25, 0.25, 16/64, 8/64, 1, 1, 1, 1,
        -0.25, -0.25, 0.25, 8/64, 8/64, 1, 1, 1, 1,
        
        // Rear        
        -0.25, 0.25, 0.25, 24/64, 8/64, 1, 1, 1, 1,
        0.25, 0.25, 0.25, 32/64, 8/64, 1, 1, 1, 1,
        0.25, 0.25, -0.25, 32/64, 16/64, 1, 1, 1, 1,
        0.25, 0.25, -0.25, 32/64, 16/64, 1, 1, 1, 1,
        -0.25, 0.25, -0.25, 24/64, 16/64, 1, 1, 1, 1,
        -0.25, 0.25, 0.25, 24/64, 8/64, 1, 1, 1, 1,
        
        // Right
        -0.25, -0.25, 0.25, 16/64, 8/64, 1, 1, 1, 1,
        -0.25, 0.25, 0.25, 24/64, 8/64, 1, 1, 1, 1,
        -0.25, 0.25, -0.25, 24/64, 16/64, 1, 1, 1, 1,
        -0.25, 0.25, -0.25, 24/64, 16/64, 1, 1, 1, 1,
        -0.25, -0.25, -0.25, 16/64, 16/64, 1, 1, 1, 1,
        -0.25, -0.25, 0.25, 16/64, 8/64, 1, 1, 1, 1,
        
        // Left
        0.25, -0.25, 0.25, 8/64, 8/64, 1, 1, 1, 1,
        0.25, -0.25, -0.25, 8/64, 16/64, 1, 1, 1, 1,
        0.25, 0.25, -0.25, 0/64, 16/64, 1, 1, 1, 1,
        0.25, 0.25, -0.25, 0/64, 16/64, 1, 1, 1, 1,
        0.25, 0.25, 0.25, 0/64, 8/64, 1, 1, 1, 1,
        0.25, -0.25, 0.25, 8/64, 8/64, 1, 1, 1, 1

    ];

    var buffer = gl.createBuffer();
    buffer.vertices = vertices.length / 9;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    
    return this.playerHead = buffer;

}

// Loads the player body model into a vertex buffer for rendering.
PlayerModel.prototype.loadPlayerBodyModel = function(gl) {

    var gl = this.gl;

    var vertices = [
        // Player torso
        
        // Top
        -0.30, -0.125, 1.45, 20/64, 16/64, 1, 1, 1, 1,
        0.30, -0.125, 1.45, 28/64, 16/64, 1, 1, 1, 1,
        0.30, 0.125, 1.45, 28/64, 20/64, 1, 1, 1, 1,
        0.30, 0.125, 1.45, 28/64, 20/64, 1, 1, 1, 1,
        -0.30, 0.125, 1.45, 20/64, 20/64, 1, 1, 1, 1,
        -0.30, -0.125, 1.45, 20/64, 16/64, 1, 1, 1, 1,
        
        // Bottom
        -0.30, -0.125, 0.73, 28/64, 16/64, 1, 1, 1, 1,
        -0.30, 0.125, 0.73, 28/64, 20/64, 1, 1, 1, 1,
        0.30, 0.125, 0.73, 36/64, 20/64, 1, 1, 1, 1,
        0.30, 0.125, 0.73, 36/64, 20/64, 1, 1, 1, 1,
        0.30, -0.125, 0.73, 36/64, 16/64, 1, 1, 1, 1,
        -0.30, -0.125, 0.73, 28/64, 16/64, 1, 1, 1, 1,
        
        // Front        
        -0.30, -0.125, 1.45, 20/64, 20/64, 1, 1, 1, 1,
        -0.30, -0.125, 0.73, 20/64, 32/64, 1, 1, 1, 1,
        0.30, -0.125, 0.73, 28/64, 32/64, 1, 1, 1, 1,
        0.30, -0.125, 0.73, 28/64, 32/64, 1, 1, 1, 1,
        0.30, -0.125, 1.45, 28/64, 20/64, 1, 1, 1, 1,
        -0.30, -0.125, 1.45, 20/64, 20/64, 1, 1, 1, 1,
        
        // Rear        
        -0.30, 0.125, 1.45, 40/64, 20/64, 1, 1, 1, 1,
        0.30, 0.125, 1.45, 32/64, 20/64, 1, 1, 1, 1,
        0.30, 0.125, 0.73, 32/64, 32/64, 1, 1, 1, 1,
        0.30, 0.125, 0.73, 32/64, 32/64, 1, 1, 1, 1,
        -0.30, 0.125, 0.73, 40/64, 32/64, 1, 1, 1, 1,
        -0.30, 0.125, 1.45, 40/64, 20/64, 1, 1, 1, 1,
        
        // Right
        -0.30, -0.125, 1.45, 16/64, 20/64, 1, 1, 1, 1,
        -0.30, 0.125, 1.45, 20/64, 20/64, 1, 1, 1, 1,
        -0.30, 0.125, 0.73, 20/64, 32/64, 1, 1, 1, 1,
        -0.30, 0.125, 0.73, 20/64, 32/64, 1, 1, 1, 1,
        -0.30, -0.125, 0.73, 16/64, 32/64, 1, 1, 1, 1,
        -0.30, -0.125, 1.45, 16/64, 20/64, 1, 1, 1, 1,
        
        // Left
        0.30, -0.125, 1.45, 28/64, 20/64, 1, 1, 1, 1,
        0.30, -0.125, 0.73, 28/64, 32/64, 1, 1, 1, 1,
        0.30, 0.125, 0.73, 32/64, 32/64, 1, 1, 1, 1,
        0.30, 0.125, 0.73, 32/64, 32/64, 1, 1, 1, 1,
        0.30, 0.125, 1.45, 32/64, 20/64, 1, 1, 1, 1,
        0.30, -0.125, 1.45, 28/64, 20/64, 1, 1, 1, 1,
        
    ];
    
    var buffer = this.playerBody = gl.createBuffer();
    buffer.vertices = vertices.length / 9;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer );
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

    var vertices = [
        // Left arm
        
        // Top
        0.30, -0.125, 0.05, 44/64, 16/64, 1, 1, 1, 1,
        0.55, -0.125, 0.05, 48/64, 16/64, 1, 1, 1, 1,
        0.55,  0.125, 0.05, 48/64, 20/64, 1, 1, 1, 1,
        0.55,  0.125, 0.05, 48/64, 20/64, 1, 1, 1, 1,
        0.30,  0.125, 0.05, 44/64, 20/64, 1, 1, 1, 1,
        0.30, -0.125, 0.05, 44/64, 16/64, 1, 1, 1, 1,
        
        // Bottom
        0.30, -0.125, -0.67, 48/64, 16/64, 1, 1, 1, 1,
        0.30,  0.125, -0.67, 48/64, 20/64, 1, 1, 1, 1,
        0.55,  0.125, -0.67, 52/64, 20/64, 1, 1, 1, 1,
        0.55,  0.125, -0.67, 52/64, 20/64, 1, 1, 1, 1,
        0.55, -0.125, -0.67, 52/64, 16/64, 1, 1, 1, 1,
        0.30, -0.125, -0.67, 48/64, 16/64, 1, 1, 1, 1,
        
        // Front        
        0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1,
        0.30, -0.125, -0.67, 48/64, 32/64, 1, 1, 1, 1,
        0.55, -0.125, -0.67, 44/64, 32/64, 1, 1, 1, 1,
        0.55, -0.125, -0.67, 44/64, 32/64, 1, 1, 1, 1,
        0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1,
        0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1,
        
        // Rear        
        0.30, 0.125,  0.05, 52/64, 20/64, 1, 1, 1, 1,
        0.55, 0.125,  0.05, 56/64, 20/64, 1, 1, 1, 1,
        0.55, 0.125, -0.67, 56/64, 32/64, 1, 1, 1, 1,
        0.55, 0.125, -0.67, 56/64, 32/64, 1, 1, 1, 1,
        0.30, 0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1,
        0.30, 0.125,  0.05, 52/64, 20/64, 1, 1, 1, 1,
        
        // Right
        0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1,
        0.30,  0.125,  0.05, 52/64, 20/64, 1, 1, 1, 1,
        0.30,  0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1,
        0.30,  0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1,
        0.30, -0.125, -0.67, 48/64, 32/64, 1, 1, 1, 1,
        0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1,
        
        // Left
        0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1,
        0.55, -0.125, -0.67, 44/64, 32/64, 1, 1, 1, 1,
        0.55,  0.125, -0.67, 40/64, 32/64, 1, 1, 1, 1,
        0.55,  0.125, -0.67, 40/64, 32/64, 1, 1, 1, 1,
        0.55,  0.125,  0.05, 40/64, 20/64, 1, 1, 1, 1,
        0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1,
        
    ];

    var buffer = this.playerLeftArm = gl.createBuffer();
    buffer.vertices = vertices.length / 9;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.DYNAMIC_DRAW);

    var vertices = [
        // Right arm
        
        // Top
        -0.55, -0.125, 0.05, 44/64, 16/64, 1, 1, 1, 1,
        -0.30, -0.125, 0.05, 48/64, 16/64, 1, 1, 1, 1,
        -0.30,  0.125, 0.05, 48/64, 20/64, 1, 1, 1, 1,
        -0.30,  0.125, 0.05, 48/64, 20/64, 1, 1, 1, 1,
        -0.55,  0.125, 0.05, 44/64, 20/64, 1, 1, 1, 1,
        -0.55, -0.125, 0.05, 44/64, 16/64, 1, 1, 1, 1,
        
        // Bottom
        -0.55, -0.125, -0.67, 52/64, 16/64, 1, 1, 1, 1,
        -0.55,  0.125, -0.67, 52/64, 20/64, 1, 1, 1, 1,
        -0.30,  0.125, -0.67, 48/64, 20/64, 1, 1, 1, 1,
        -0.30,  0.125, -0.67, 48/64, 20/64, 1, 1, 1, 1,
        -0.30, -0.125, -0.67, 48/64, 16/64, 1, 1, 1, 1,
        -0.55, -0.125, -0.67, 52/64, 16/64, 1, 1, 1, 1,
        
        // Front        
        -0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1,
        -0.55, -0.125, -0.67, 44/64, 32/64, 1, 1, 1, 1,
        -0.30, -0.125, -0.67, 48/64, 32/64, 1, 1, 1, 1,
        -0.30, -0.125, -0.67, 48/64, 32/64, 1, 1, 1, 1,
        -0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1,
        -0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1,
        
        // Rear        
        -0.55, 0.125,  0.05, 56/64, 20/64, 1, 1, 1, 1,
        -0.30, 0.125,  0.05, 52/64, 20/64, 1, 1, 1, 1,
        -0.30, 0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1,
        -0.30, 0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1,
        -0.55, 0.125, -0.67, 56/64, 32/64, 1, 1, 1, 1,
        -0.55, 0.125,  0.05, 56/64, 20/64, 1, 1, 1, 1,
        
        // Right
        -0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1,
        -0.55,  0.125,  0.05, 40/64, 20/64, 1, 1, 1, 1,
        -0.55,  0.125, -0.67, 40/64, 32/64, 1, 1, 1, 1,
        -0.55,  0.125, -0.67, 40/64, 32/64, 1, 1, 1, 1,
        -0.55, -0.125, -0.67, 44/64, 32/64, 1, 1, 1, 1,
        -0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1,
        
        // Left
        -0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1,
        -0.30, -0.125, -0.67, 48/64, 32/64, 1, 1, 1, 1,
        -0.30,  0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1,
        -0.30,  0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1,
        -0.30,  0.125,  0.05, 52/64, 20/64, 1, 1, 1, 1,
        -0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1,
        
    ];
    
    var buffer = this.playerRightArm = gl.createBuffer();
    buffer.vertices = vertices.length / 9;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.DYNAMIC_DRAW);

    var vertices = [
        // Left leg
        
        // Top
        0.01, -0.125, 0, 4/64, 16/64, 1, 1, 1, 1,
        0.3,  -0.125, 0, 8/64, 16/64, 1, 1, 1, 1,
        0.3,   0.125, 0, 8/64, 20/64, 1, 1, 1, 1,
        0.3,   0.125, 0, 8/64, 20/64, 1, 1, 1, 1,
        0.01,  0.125, 0, 4/64, 20/64, 1, 1, 1, 1,
        0.01, -0.125, 0, 4/64, 16/64, 1, 1, 1, 1,
        
        // Bottom
        0.01, -0.125, -0.73,  8/64, 16/64, 1, 1, 1, 1,
        0.01,  0.125, -0.73,  8/64, 20/64, 1, 1, 1, 1,
        0.3,   0.125, -0.73, 12/64, 20/64, 1, 1, 1, 1,
        0.3,   0.125, -0.73, 12/64, 20/64, 1, 1, 1, 1,
        0.3,  -0.125, -0.73, 12/64, 16/64, 1, 1, 1, 1,
        0.01, -0.125, -0.73,  8/64, 16/64, 1, 1, 1, 1,
        
        // Front        
        0.01, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1,
        0.01, -0.125, -0.73, 4/64, 32/64, 1, 1, 1, 1,
        0.3,  -0.125, -0.73, 8/64, 32/64, 1, 1, 1, 1,
        0.3,  -0.125, -0.73, 8/64, 32/64, 1, 1, 1, 1,
        0.3,  -0.125,     0, 8/64, 20/64, 1, 1, 1, 1,
        0.01, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1,
        
        // Rear        
        0.01, 0.125,     0, 12/64, 20/64, 1, 1, 1, 1,
        0.3,  0.125,     0, 16/64, 20/64, 1, 1, 1, 1,
        0.3,  0.125, -0.73, 16/64, 32/64, 1, 1, 1, 1,
        0.3,  0.125, -0.73, 16/64, 32/64, 1, 1, 1, 1,
        0.01, 0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1,
        0.01, 0.125,     0, 12/64, 20/64, 1, 1, 1, 1,
        
        // Right
        0.01, -0.125,     0,  8/64, 20/64, 1, 1, 1, 1,
        0.01,  0.125,     0, 12/64, 20/64, 1, 1, 1, 1,
        0.01,  0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1,
        0.01,  0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1,
        0.01, -0.125, -0.73,  8/64, 32/64, 1, 1, 1, 1,
        0.01, -0.125,     0,  8/64, 20/64, 1, 1, 1, 1,
        
        // Left
        0.3, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1,
        0.3, -0.125, -0.73, 4/64, 32/64, 1, 1, 1, 1,
        0.3,  0.125, -0.73, 0/64, 32/64, 1, 1, 1, 1,
        0.3,  0.125, -0.73, 0/64, 32/64, 1, 1, 1, 1,
        0.3,  0.125,     0, 0/64, 20/64, 1, 1, 1, 1,
        0.3, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1,
    ];
    
    var buffer = this.playerLeftLeg = gl.createBuffer();
    buffer.vertices = vertices.length / 9;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

    var vertices = [
        // Right leg

        // Top
        -0.3,  -0.125, 0, 4/64, 16/64, 1, 1, 1, 1,
        -0.01, -0.125, 0, 8/64, 16/64, 1, 1, 1, 1,
        -0.01,  0.125, 0, 8/64, 20/64, 1, 1, 1, 1,
        -0.01,  0.125, 0, 8/64, 20/64, 1, 1, 1, 1,
        -0.3,   0.125, 0, 4/64, 20/64, 1, 1, 1, 1,
        -0.3,  -0.125, 0, 4/64, 16/64, 1, 1, 1, 1,

        // Bottom
        -0.3,  -0.125, -0.73,  8/64, 16/64, 1, 1, 1, 1,
        -0.3,   0.125, -0.73,  8/64, 20/64, 1, 1, 1, 1,
        -0.01,  0.125, -0.73, 12/64, 20/64, 1, 1, 1, 1,
        -0.01,  0.125, -0.73, 12/64, 20/64, 1, 1, 1, 1,
        -0.01, -0.125, -0.73, 12/64, 16/64, 1, 1, 1, 1,
        -0.3,  -0.125, -0.73,  8/64, 16/64, 1, 1, 1, 1,

        // Front
        -0.3,  -0.125,     0, 4/64, 20/64, 1, 1, 1, 1,
        -0.3,  -0.125, -0.73, 4/64, 32/64, 1, 1, 1, 1,
        -0.01, -0.125, -0.73, 8/64, 32/64, 1, 1, 1, 1,
        -0.01, -0.125, -0.73, 8/64, 32/64, 1, 1, 1, 1,
        -0.01, -0.125,     0, 8/64, 20/64, 1, 1, 1, 1,
        -0.3,  -0.125,     0, 4/64, 20/64, 1, 1, 1, 1,

        // Rear        
        -0.3,  0.125,     0, 16/64, 20/64, 1, 1, 1, 1,
        -0.01, 0.125,     0, 12/64, 20/64, 1, 1, 1, 1,
        -0.01, 0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1,
        -0.01, 0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1,
        -0.3,  0.125, -0.73, 16/64, 32/64, 1, 1, 1, 1,
        -0.3,  0.125,     0, 16/64, 20/64, 1, 1, 1, 1,

        // Right
        -0.3, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1,
        -0.3,  0.125,     0, 0/64, 20/64, 1, 1, 1, 1,
        -0.3,  0.125, -0.73, 0/64, 32/64, 1, 1, 1, 1,
        -0.3,  0.125, -0.73, 0/64, 32/64, 1, 1, 1, 1,
        -0.3, -0.125, -0.73, 4/64, 32/64, 1, 1, 1, 1,
        -0.3, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1,

        // Left
        -0.01, -0.125,    0,   8/64, 20/64, 1, 1, 1, 1,
        -0.01, -0.125, -0.73,  8/64, 32/64, 1, 1, 1, 1,
        -0.01,  0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1,
        -0.01,  0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1,
        -0.01,  0.125,     0, 12/64, 20/64, 1, 1, 1, 1,
        -0.01, -0.125,     0,  8/64, 20/64, 1, 1, 1, 1
    ];

    var buffer = this.playerRightLeg = gl.createBuffer();
    buffer.vertices = vertices.length / 9;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

}

// drawLayer
PlayerModel.prototype.drawLayer = function(render, modelMatrix, uModelMat, camPos, options) {
    
    const gl        = this.gl;
    const scale     = options.scale;
    const z_minus   = (this.height * options.scale - this.height);

    var aniangle = 0;
    if(this.moving || Math.abs(this.aniframe) > 0.1) {
        this.aniframe += 0.15;
        if(this.aniframe > Math.PI) {
            this.aniframe  = -Math.PI;
        }
        aniangle = Math.PI / 2 * Math.sin(this.aniframe);
        if(!this.moving && Math.abs(aniangle) < 0.1) {
            this.aniframe = 0;
        }
    }

    // Draw head
    var pitch = this.pitch;
    if(pitch < -0.32 ) {
        pitch = -0.32;
    }
    if(pitch > 0.32 ) {
        pitch = 0.32;
    }

    // Load mesh
    if(!this.playerHead) {
        // console.log('Loading mesh');
        this.loadMesh();
    }

    // Wait loading texture
    if(!options.texture) {
        // console.log('texPlayer not loaded');
        return;
    }

    // Draw head
    mat4.identity(modelMatrix);
    mat4.translate(modelMatrix, [this.pos.x - Game.shift.x, this.pos.y - Game.shift.y, this.pos.z + this.height * options.scale - z_minus]);
    mat4.scale(modelMatrix, [scale, scale, scale]);
    mat4.rotateZ(modelMatrix, Math.PI - this.yaw);
    mat4.rotateX(modelMatrix, -pitch);
    gl.uniformMatrix4fv(uModelMat, false, modelMatrix);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, options.texture);
    render.drawBuffer(this.playerHead);

    // Draw body
    mat4.identity(modelMatrix);
    mat4.translate(modelMatrix, [this.pos.x - Game.shift.x, this.pos.y - Game.shift.y, this.pos.z + 0.01 - z_minus / 2]);
    mat4.scale(modelMatrix, [scale, scale, scale]);
    mat4.rotateZ(modelMatrix, Math.PI - this.yaw);
    gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
    render.drawBuffer(this.playerBody);

    // Left arm
    mat4.translate(modelMatrix, [ 0, 0, 1.4]);
    mat4.rotateX(modelMatrix, 0.75 * aniangle);
    gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
    render.drawBuffer(this.playerLeftArm);

    // Right arm
    mat4.rotateX(modelMatrix, -1.5 * aniangle);
    gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
    render.drawBuffer(this.playerRightArm);
    mat4.rotateX(modelMatrix, 0.75 * aniangle);
    mat4.translate(modelMatrix, [ 0, 0, -0.67] );

    // Right leg
    mat4.rotateX(modelMatrix, 0.5 * aniangle);
    gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
    render.drawBuffer(this.playerRightLeg);

    // Left leg
    mat4.rotateX(modelMatrix, -aniangle);
    gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
    render.drawBuffer(this.playerLeftLeg);

    if(options.draw_nametag) {
        // Draw player name
        if(!this.nametag) {
            this.nametag = this.buildPlayerName(this.nick);
        }

        mat4.identity(modelMatrix);
        // Calculate angle so that the nametag always faces the local player
        var angZ = -Math.PI/2 + Math.atan2((camPos[1] - Game.shift.y) - (this.pos.y - Game.shift.y), (camPos[0] - Game.shift.x) - (this.pos.x - Game.shift.x));
        var angX = 0; // @todo
        
        mat4.translate(modelMatrix, [this.pos.x - Game.shift.x, this.pos.y - Game.shift.y, this.pos.z + (this.height + 0.35) * options.scale - z_minus]);
        mat4.rotateZ(modelMatrix, angZ);
        mat4.rotateX(modelMatrix, angX);
        mat4.scale(modelMatrix, [0.005, 1, 0.005]);
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
        gl.bindTexture(gl.TEXTURE_2D, this.nametag.texture);

        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        render.drawBuffer(this.nametag.model);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
    }

}

// Returns the texture and vertex buffer for drawing the name
// tag of the specified player over head.
PlayerModel.prototype.buildPlayerName = function(nickname) {
    nickname        = nickname.replace( /&lt;/g, "<" ).replace( /&gt;/g, ">" ).replace( /&quot;/, "\"" );
    var gl          = this.gl;
    var canvas      = this.textCanvas;
    var ctx         = this.textContext;
    var w           = ctx.measureText(nickname).width + 16;
    var h           = 45;
    // Draw text box
    ctx.fillStyle   = '#00000055';
    ctx.fillRect(0, 0, w, 45);
    ctx.fillStyle   = '#fff';
    ctx.font        = '24px Minecraftia';
    ctx.fillText(nickname, 10, 12);
    // Create texture
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Create model
    var vertices = [
        -w/2, 0, h, w/256, 0, 1, 1, 1, 0.7,
        w/2, 0, h, 0, 0, 1, 1, 1, 0.7,
        w/2, 0, 0, 0, h/64, 1, 1, 1, 0.7,
        w/2, 0, 0, 0, h/64, 1, 1, 1, 0.7,
        -w/2, 0, 0, w/256, h/64, 1, 1, 1, 0.7,
        -w/2, 0, h, w/256, 0, 1, 1, 1, 0.7
    ];
    var buffer = gl.createBuffer();
    buffer.vertices = vertices.length / 9;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    return {
        texture: tex,
        model: buffer
    };
}