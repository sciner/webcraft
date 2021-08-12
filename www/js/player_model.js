"use strict";
import GeometryTerrain from "./geometry_terrain.js";
import {NORMALS, Vector, Helpers} from './helpers.js';

export default class PlayerModel {

    constructor(props) {
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
    draw(render, modelMatrix, uModelMat, camPos, delta) {
        this.drawLayer(render, modelMatrix, uModelMat, camPos, delta, {
            scale:          1.0,
            texture:        this.texPlayer,
            draw_nametag:   false
        });

        const gl = this.gl;
        gl.disable(gl.CULL_FACE);

        this.drawLayer(render, modelMatrix, uModelMat, camPos, delta, {
            scale:          1.05,
            texture:        this.texPlayer2,
            draw_nametag:   true
        });

        gl.enable(gl.CULL_FACE);

    }

    // loadMesh...
    loadMesh() {
        this.loadPlayerHeadModel();
        this.loadPlayerBodyModel();
        this.loadTextures();
    }

    // loadTextures...
    loadTextures() {
        let that = this;
        let gl = this.gl;
        // Load player texture
        let image = new Image();
        image.onload = function() {
            Helpers.createSkinLayer2(null, image, function(file) {
                let image2 = new Image();
                image2.onload = function(e) {
                    gl.activeTexture(gl.TEXTURE0);
                    // Layer1
                    let texture = gl.createTexture();
                    texture.image = image;
                    that.texPlayer = texture;
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                    // Layer2
                    let texture2 = gl.createTexture();
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
    loadPlayerHeadModel() {

        // [x, y, z, tX, tY, lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],

        // Player head
        let vertices = [
            // Top
            -0.25, -0.25, 0.25, 8/64, 0, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.25, -0.25, 0.25, 16/64, 0, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.25, 0.25, 0.25, 16/64, 8/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.25, 0.25, 0.25, 16/64, 8/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.25, 0.25, 0.25, 8/64, 8/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.25, -0.25, 0.25, 8/64, 0, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,

            // Bottom
            -0.25, -0.25, -0.25, 16/64, 0, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.25, 0.25, -0.25, 16/64, 8/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.25, 0.25, -0.25, 24/64, 8/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.25, 0.25, -0.25, 24/64, 8/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.25, -0.25, -0.25, 24/64, 0, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.25, -0.25, -0.25, 16/64, 0, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,

            // Front
            -0.25, -0.25, 0.25, 8/64, 8/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.25, -0.25, -0.25, 8/64, 16/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.25, -0.25, -0.25, 16/64, 16/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.25, -0.25, -0.25, 16/64, 16/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.25, -0.25, 0.25, 16/64, 8/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.25, -0.25, 0.25, 8/64, 8/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,

            // Rear
            -0.25, 0.25, 0.25, 24/64, 8/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.25, 0.25, 0.25, 32/64, 8/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.25, 0.25, -0.25, 32/64, 16/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.25, 0.25, -0.25, 32/64, 16/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.25, 0.25, -0.25, 24/64, 16/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.25, 0.25, 0.25, 24/64, 8/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,

            // Right
            -0.25, -0.25, 0.25, 16/64, 8/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.25, 0.25, 0.25, 24/64, 8/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.25, 0.25, -0.25, 24/64, 16/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.25, 0.25, -0.25, 24/64, 16/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.25, -0.25, -0.25, 16/64, 16/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.25, -0.25, 0.25, 16/64, 8/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,

            // Left
            0.25, -0.25, 0.25, 8/64, 8/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.25, -0.25, -0.25, 8/64, 16/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.25, 0.25, -0.25, 0/64, 16/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.25, 0.25, -0.25, 0/64, 16/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.25, 0.25, 0.25, 0/64, 8/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.25, -0.25, 0.25, 8/64, 8/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,

        ];

        return this.playerHead = new GeometryTerrain(GeometryTerrain.convertFrom12(vertices));

    }

    // Loads the player body model into a vertex buffer for rendering.
    loadPlayerBodyModel(gl) {

        let vertices = [
            // Player torso

            // Top
            -0.30, -0.125, 1.45, 20/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.30, -0.125, 1.45, 28/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.30, 0.125, 1.45, 28/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.30, 0.125, 1.45, 28/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.30, 0.125, 1.45, 20/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.30, -0.125, 1.45, 20/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,

            // Bottom
            -0.30, -0.125, 0.73, 28/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.30, 0.125, 0.73, 28/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.30, 0.125, 0.73, 36/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.30, 0.125, 0.73, 36/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.30, -0.125, 0.73, 36/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.30, -0.125, 0.73, 28/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,

            // Front
            -0.30, -0.125, 1.45, 20/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.30, -0.125, 0.73, 20/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.30, -0.125, 0.73, 28/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.30, -0.125, 0.73, 28/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.30, -0.125, 1.45, 28/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.30, -0.125, 1.45, 20/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,

            // Rear
            -0.30, 0.125, 1.45, 40/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.30, 0.125, 1.45, 32/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.30, 0.125, 0.73, 32/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.30, 0.125, 0.73, 32/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.30, 0.125, 0.73, 40/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.30, 0.125, 1.45, 40/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,

            // Right
            -0.30, -0.125, 1.45, 16/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.30, 0.125, 1.45, 20/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.30, 0.125, 0.73, 20/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.30, 0.125, 0.73, 20/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.30, -0.125, 0.73, 16/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.30, -0.125, 1.45, 16/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,

            // Left
            0.30, -0.125, 1.45, 28/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.30, -0.125, 0.73, 28/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.30, 0.125, 0.73, 32/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.30, 0.125, 0.73, 32/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.30, 0.125, 1.45, 32/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.30, -0.125, 1.45, 28/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,

        ];

        this.playerBody = new GeometryTerrain(GeometryTerrain.convertFrom12(vertices));

        vertices = [
            // Left arm

            // Top
            0.30, -0.125, 0.05, 44/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.55, -0.125, 0.05, 48/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.55,  0.125, 0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.55,  0.125, 0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.30,  0.125, 0.05, 44/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.30, -0.125, 0.05, 44/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,

            // Bottom
            0.30, -0.125, -0.67, 48/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.30,  0.125, -0.67, 48/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.55,  0.125, -0.67, 52/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.55,  0.125, -0.67, 52/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.55, -0.125, -0.67, 52/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.30, -0.125, -0.67, 48/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,

            // Front
            0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.30, -0.125, -0.67, 48/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.55, -0.125, -0.67, 44/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.55, -0.125, -0.67, 44/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,

            // Rear
            0.30, 0.125,  0.05, 52/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.55, 0.125,  0.05, 56/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.55, 0.125, -0.67, 56/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.55, 0.125, -0.67, 56/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.30, 0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.30, 0.125,  0.05, 52/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,

            // Right
            0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            0.30,  0.125,  0.05, 52/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            0.30,  0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            0.30,  0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            0.30, -0.125, -0.67, 48/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,

            // Left
            0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.55, -0.125, -0.67, 44/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.55,  0.125, -0.67, 40/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.55,  0.125, -0.67, 40/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.55,  0.125,  0.05, 40/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,

        ];

        this.playerLeftArm = new GeometryTerrain(GeometryTerrain.convertFrom12(vertices));

        vertices = [
            // Right arm

            // Top
            -0.55, -0.125, 0.05, 44/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.30, -0.125, 0.05, 48/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.30,  0.125, 0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.30,  0.125, 0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.55,  0.125, 0.05, 44/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.55, -0.125, 0.05, 44/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,

            // Bottom
            -0.55, -0.125, -0.67, 52/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.55,  0.125, -0.67, 52/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.30,  0.125, -0.67, 48/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.30,  0.125, -0.67, 48/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.30, -0.125, -0.67, 48/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.55, -0.125, -0.67, 52/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,

            // Front
            -0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.55, -0.125, -0.67, 44/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.30, -0.125, -0.67, 48/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.30, -0.125, -0.67, 48/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,

            // Rear
            -0.55, 0.125,  0.05, 56/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.30, 0.125,  0.05, 52/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.30, 0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.30, 0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.55, 0.125, -0.67, 56/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.55, 0.125,  0.05, 56/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,

            // Right
            -0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.55,  0.125,  0.05, 40/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.55,  0.125, -0.67, 40/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.55,  0.125, -0.67, 40/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.55, -0.125, -0.67, 44/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.55, -0.125,  0.05, 44/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,

            // Left
            -0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            -0.30, -0.125, -0.67, 48/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            -0.30,  0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            -0.30,  0.125, -0.67, 52/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            -0.30,  0.125,  0.05, 52/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            -0.30, -0.125,  0.05, 48/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,

        ];

        this.playerRightArm = new GeometryTerrain(GeometryTerrain.convertFrom12(vertices));

        vertices = [
            // Left leg

            // Top
            0.01, -0.125, 0, 4/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.3,  -0.125, 0, 8/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.3,   0.125, 0, 8/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.3,   0.125, 0, 8/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.01,  0.125, 0, 4/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.01, -0.125, 0, 4/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,

            // Bottom
            0.01, -0.125, -0.73,  8/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.01,  0.125, -0.73,  8/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.3,   0.125, -0.73, 12/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.3,   0.125, -0.73, 12/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.3,  -0.125, -0.73, 12/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.01, -0.125, -0.73,  8/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,

            // Front
            0.01, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.01, -0.125, -0.73, 4/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.3,  -0.125, -0.73, 8/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.3,  -0.125, -0.73, 8/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.3,  -0.125,     0, 8/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.01, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,

            // Rear
            0.01, 0.125,     0, 12/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.3,  0.125,     0, 16/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.3,  0.125, -0.73, 16/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.3,  0.125, -0.73, 16/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.01, 0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.01, 0.125,     0, 12/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,

            // Right
            0.01, -0.125,     0,  8/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            0.01,  0.125,     0, 12/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            0.01,  0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            0.01,  0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            0.01, -0.125, -0.73,  8/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            0.01, -0.125,     0,  8/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,

            // Left
            0.3, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.3, -0.125, -0.73, 4/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.3,  0.125, -0.73, 0/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.3,  0.125, -0.73, 0/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.3,  0.125,     0, 0/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.3, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
        ];

        this.playerLeftLeg = new GeometryTerrain(GeometryTerrain.convertFrom12(vertices));

        vertices = [
            // Right leg

            // Top
            -0.3,  -0.125, 0, 4/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.01, -0.125, 0, 8/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.01,  0.125, 0, 8/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.01,  0.125, 0, 8/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.3,   0.125, 0, 4/64, 20/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.3,  -0.125, 0, 4/64, 16/64, 1, 1, 1, 1, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,

            // Bottom
            -0.3,  -0.125, -0.73,  8/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.3,   0.125, -0.73,  8/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.01,  0.125, -0.73, 12/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.01,  0.125, -0.73, 12/64, 20/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.01, -0.125, -0.73, 12/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.3,  -0.125, -0.73,  8/64, 16/64, 1, 1, 1, 1, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,

            // Front
            -0.3,  -0.125,     0, 4/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.3,  -0.125, -0.73, 4/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.01, -0.125, -0.73, 8/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.01, -0.125, -0.73, 8/64, 32/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.01, -0.125,     0, 8/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.3,  -0.125,     0, 4/64, 20/64, 1, 1, 1, 1, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,

            // Rear
            -0.3,  0.125,     0, 16/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.01, 0.125,     0, 12/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.01, 0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.01, 0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.3,  0.125, -0.73, 16/64, 32/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.3,  0.125,     0, 16/64, 20/64, 1, 1, 1, 1, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,

            // Right
            -0.3, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.3,  0.125,     0, 0/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.3,  0.125, -0.73, 0/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.3,  0.125, -0.73, 0/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.3, -0.125, -0.73, 4/64, 32/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.3, -0.125,     0, 4/64, 20/64, 1, 1, 1, 1, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,

            // Left
            -0.01, -0.125,    0,   8/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            -0.01, -0.125, -0.73,  8/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            -0.01,  0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            -0.01,  0.125, -0.73, 12/64, 32/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            -0.01,  0.125,     0, 12/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            -0.01, -0.125,     0,  8/64, 20/64, 1, 1, 1, 1, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
        ];

        this.playerRightLeg = new GeometryTerrain(GeometryTerrain.convertFrom12(vertices));
    }

    // drawLayer
    drawLayer(render, modelMatrix, uModelMat, camPos, delta, options) {

        const gl        = this.gl;
        const scale     = options.scale;
        const z_minus   = (this.height * options.scale - this.height);

        let aniangle = 0;
        if(this.moving || Math.abs(this.aniframe) > 0.1) {
            this.aniframe += (0.1 / 1000 * delta);
            if(this.aniframe > Math.PI) {
                this.aniframe  = -Math.PI;
            }
            aniangle = Math.PI / 2 * Math.sin(this.aniframe);
            if(!this.moving && Math.abs(aniangle) < 0.1) {
                this.aniframe = 0;
            }
        }

        // Draw head
        let pitch = this.pitch;
        if(pitch < -0.5) {
            pitch = -0.5;
        }
        if(pitch > 0.5) {
            pitch = 0.5;
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

        let a_pos = new Vector(this.pos.x - Game.shift.x, this.pos.z - Game.shift.z, this.pos.y - Game.shift.y);

        // Draw head
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, [this.pos.x - Game.shift.x, this.pos.z - Game.shift.z, this.pos.y + this.height * options.scale - z_minus]);
        mat4.scale(modelMatrix, [scale, scale, scale]);
        mat4.rotateZ(modelMatrix, Math.PI - this.yaw);
        mat4.rotateX(modelMatrix, -pitch);
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);

        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, options.texture);
        render.drawBuffer(this.playerHead, a_pos);

        // Draw body
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, [this.pos.x - Game.shift.x, this.pos.z - Game.shift.z, this.pos.y + 0.01 - z_minus / 2]);
        mat4.scale(modelMatrix, [scale, scale, scale]);
        mat4.rotateZ(modelMatrix, Math.PI - this.yaw);
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
        render.drawBuffer(this.playerBody, a_pos);

        // Left arm
        mat4.translate(modelMatrix, [ 0, 0, 1.4]);
        mat4.rotateX(modelMatrix, 0.75 * aniangle);
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
        render.drawBuffer(this.playerLeftArm, a_pos);

        // Right arm
        mat4.rotateX(modelMatrix, -1.5 * aniangle);
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
        render.drawBuffer(this.playerRightArm, a_pos);
        mat4.rotateX(modelMatrix, 0.75 * aniangle);
        mat4.translate(modelMatrix, [ 0, 0, -0.67] );

        // Right leg
        mat4.rotateX(modelMatrix, 0.5 * aniangle);
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
        render.drawBuffer(this.playerRightLeg, a_pos);

        // Left leg
        mat4.rotateX(modelMatrix, -aniangle);
        gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
        render.drawBuffer(this.playerLeftLeg, a_pos);

        if(options.draw_nametag) {
            // Draw player name
            if(!this.nametag) {
                this.nametag = this.buildPlayerName(this.nick);
            }

            mat4.identity(modelMatrix);
            // Calculate angle so that the nametag always faces the local player
            let angZ = -Math.PI/2 + Math.atan2((camPos[2] - Game.shift.z) - (this.pos.z - Game.shift.z), (camPos[0] - Game.shift.x) - (this.pos.x - Game.shift.x));
            let angX = 0; // @todo

            mat4.translate(modelMatrix, [this.pos.x - Game.shift.x, this.pos.z - Game.shift.z, this.pos.y + (this.height + 0.35) * options.scale - z_minus]);
            mat4.rotateZ(modelMatrix, angZ);
            mat4.rotateX(modelMatrix, angX);
            mat4.scale(modelMatrix, [0.005, 1, 0.005]);
            gl.uniformMatrix4fv(uModelMat, false, modelMatrix);
            gl.bindTexture(gl.TEXTURE_2D, this.nametag.texture);

            gl.disable(gl.CULL_FACE);
            gl.disable(gl.DEPTH_TEST);
            render.drawBuffer(this.nametag.model, a_pos);
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.DEPTH_TEST);
        }

    }

    // Returns the texture and vertex buffer for drawing the name
    // tag of the specified player over head.
    buildPlayerName(nickname) {
        nickname        = nickname.replace( /&lt;/g, "<" ).replace( /&gt;/g, ">" ).replace( /&quot;/, "\"" );
        let gl          = this.gl;
        let canvas      = this.textCanvas;
        let ctx         = this.textContext;
        let w           = ctx.measureText(nickname).width + 16;
        let h           = 45;
        // Draw text box
        ctx.fillStyle   = '#00000055';
        ctx.fillRect(0, 0, w, 45);
        ctx.fillStyle   = '#fff';
        ctx.font        = '24px Minecraftia';
        ctx.fillText(nickname, 10, 12);
        // Create texture
        let tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // Create model
        let vertices = [
            -w/2, 0, h, w/256, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2, 0, h, 0, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2, 0, 0, 0, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2, 0, 0, 0, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -w/2, 0, 0, w/256, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -w/2, 0, h, w/256, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
        ];
        return {
            texture: tex,
            model: new GeometryTerrain(GeometryTerrain.convertFrom12(vertices))
        };
    }

}