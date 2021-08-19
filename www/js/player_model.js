"use strict";
import GeometryTerrain from "./geometry_terrain.js";
import {NORMALS, Vector, Helpers} from './helpers.js';
import {Resources} from "./resources.js";

const {mat4} = glMatrix;

export default class PlayerModel {

    constructor(props) {
        this.texPlayer                  = null;
        this.texPlayer2                 = null;

        this.matPlayer = null;
        this.matPlayer2 = null;

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
        this.modelMatrix = mat4.create();
    }

    // draw
    draw(render, camPos, delta) {
        const gl = this.gl = render.gl;
        this.drawLayer(render, camPos, delta, {
            scale:          1.0,
            material:       this.matPlayer,
            draw_nametag:   false
        });
        this.drawLayer(render, camPos, delta, {
            scale:          1.05,
            material:       this.matPlayer2,
            draw_nametag:   true
            // draw_nametag:   true
        });
    }

    // loadMesh...
    /**
     *
     * @param {Renderer} render
     */
    loadMesh(render) {
        this.loadPlayerHeadModel(render);
        this.loadPlayerBodyModel(render);
        this.loadTextures(render);
    }

    /**
     *
     * @param {Renderer} render
     */
    loadTextures(render) {
        Resources
            .loadImage(this.skin.file, false)
            .then(image1 => {
                Helpers.createSkinLayer2(null, image1, (file) => {
                    Resources
                        .loadImage(URL.createObjectURL(file), false)
                        .then(image2 => {
                            const texture1 = render.renderBackend.createTexture({
                                source: image1,
                                minFilter: 'nearest',
                                magFilter: 'nearest'
                            });

                            const texture2 = render.renderBackend.createTexture({
                                source: image2,
                                minFilter: 'nearest',
                                magFilter: 'nearest'
                            });

                            this.texPlayer =  texture1;
                            this.texPlayer2 = texture2;
                            this.matPlayer = render.materials.doubleface.getSubMat(texture1);
                            this.matPlayer2 = render.materials.doubleface.getSubMat(texture2);

                            document.getElementsByTagName('body')[0].append(image2);
                        })
                });
            });

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
    drawLayer(render, camPos, delta, options) {
        const {modelMatrix} = this;
        const {material, scale} = options;
        const {renderBackend} = render;
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
            this.loadMesh(render);
        }

        // Wait loading texture
        if(!options.material) {
            return;
        }

        let a_pos = new Vector(this.pos.x - Game.shift.x, this.pos.z - Game.shift.z, this.pos.y - Game.shift.y);

        // Draw head
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, modelMatrix, [0, 0, this.height * options.scale - z_minus]);
        mat4.scale(modelMatrix, modelMatrix, [scale, scale, scale]);
        mat4.rotateZ(modelMatrix, modelMatrix, Math.PI - this.yaw);
        mat4.rotateX(modelMatrix, modelMatrix, -pitch);
        renderBackend.drawMesh(this.playerHead, material, a_pos, modelMatrix);

        // Draw body
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, modelMatrix,[0, 0, 0.01 - z_minus / 2]);
        mat4.scale(modelMatrix, modelMatrix,[scale, scale, scale]);
        mat4.rotateZ(modelMatrix, modelMatrix,Math.PI - this.yaw);
        renderBackend.drawMesh(this.playerBody, material, a_pos, modelMatrix);

        // Left arm
        mat4.translate(modelMatrix, modelMatrix, [ 0, 0, 1.4]);
        mat4.rotateX(modelMatrix, modelMatrix,0.75 * aniangle);
        renderBackend.drawMesh(this.playerLeftArm, material, a_pos, modelMatrix);

        // Right arm
        mat4.rotateX(modelMatrix, modelMatrix, -1.5 * aniangle);
        renderBackend.drawMesh(this.playerRightArm, material, a_pos, modelMatrix);
        mat4.rotateX(modelMatrix, modelMatrix, 0.75 * aniangle);
        mat4.translate(modelMatrix, modelMatrix, [ 0, 0, -0.67] );

        // Right leg
        mat4.rotateX(modelMatrix, modelMatrix, 0.5 * aniangle);
        renderBackend.drawMesh(this.playerRightLeg, material, a_pos, modelMatrix);

        // Left leg
        mat4.rotateX(modelMatrix, modelMatrix, -aniangle);
        renderBackend.drawMesh(this.playerLeftLeg, material, a_pos, modelMatrix);

        if(options.draw_nametag) {
            // Draw player name
            if(!this.nametag) {
                this.nametag = this.buildPlayerName(this.nick, render);
            }

            mat4.identity(modelMatrix);
            // Calculate angle so that the nametag always faces the local player
            let angZ = -Math.PI/2 + Math.atan2((camPos[2] - Game.shift.z) - (this.pos.z - Game.shift.z), (camPos[0] - Game.shift.x) - (this.pos.x - Game.shift.x));
            let angX = 0; // @todo

            mat4.translate(modelMatrix, modelMatrix, [0, 0, (this.height + 0.35) * options.scale - z_minus]);
            mat4.rotateZ(modelMatrix, modelMatrix, angZ);
            mat4.rotateX(modelMatrix, modelMatrix, angX);
            mat4.scale(modelMatrix, modelMatrix, [0.005, 1, 0.005]);

            renderBackend.drawMesh(this.nametag.model, this.nametag.material, a_pos, modelMatrix);
        }

    }

    // Returns the texture and vertex buffer for drawing the name
    // tag of the specified player over head.
    /**
     *
     * @param {string} nickname
     * @param render
     * @return {{texture: BaseTexture, model: GeometryTerrain}}
     */
    buildPlayerName(nickname, render) {
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

        // abstraction
        const texture = render.renderBackend.createTexture({
            source: canvas,
        });

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
            material: render.materials.label.getSubMat(texture),
            model: new GeometryTerrain(GeometryTerrain.convertFrom12(vertices))
        };
    }

}
