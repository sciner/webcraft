import GeometryTerrain from "./geometry_terrain.js";
import {NORMALS, Helpers} from './helpers.js';
import {Resources} from "./resources.js";

const {mat4} = glMatrix;

export class MobModel {

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
        this.height                     = 0.26;

        this.modelMatrix                = mat4.create();

        this.skin = {
            file: '/media/skins/16.png'
        };

        Object.assign(this, props);

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
        });
    }

    // loadMesh...
    /**
     *
     * @param {Renderer} render
     */
    loadMesh(render) {
        this.loadPlayerHeadModel(render);
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
                            this.matPlayer = render.defaultShader.materials.doubleface.getSubMat(texture1);
                            this.matPlayer2 = render.defaultShader.materials.doubleface_transparent.getSubMat(texture2);
                            document.getElementsByTagName('body')[0].append(image2);
                        })
                });
            });

    }

    // Loads the player head model into a vertex buffer for rendering.
    loadPlayerHeadModel() {

        // [x, y, z, tX, tY, lm.r, lm.g, lm.b, lm.a, n.x, n.y, n.z],

        let lm = {r: 0, g: 0, b: 0, a: 0};

        // Player head
        let vertices = [
            // Top
            -0.25, -0.25, 0.25, 8/64, 0, lm.r, lm.g, lm.b, lm.a, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.25, -0.25, 0.25, 16/64, 0, lm.r, lm.g, lm.b, lm.a, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.25, 0.25, 0.25, 16/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            0.25, 0.25, 0.25, 16/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.25, 0.25, 0.25, 8/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -0.25, -0.25, 0.25, 8/64, 0, lm.r, lm.g, lm.b, lm.a, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,

            // Bottom
            -0.25, -0.25, -0.25, 16/64, 0, lm.r, lm.g, lm.b, lm.a, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.25, 0.25, -0.25, 16/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.25, 0.25, -0.25, 24/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.25, 0.25, -0.25, 24/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            0.25, -0.25, -0.25, 24/64, 0, lm.r, lm.g, lm.b, lm.a, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
            -0.25, -0.25, -0.25, 16/64, 0, lm.r, lm.g, lm.b, lm.a, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,

            // Front
            -0.25, -0.25, 0.25, 8/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.25, -0.25, -0.25, 8/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.25, -0.25, -0.25, 16/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.25, -0.25, -0.25, 16/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            0.25, -0.25, 0.25, 16/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
            -0.25, -0.25, 0.25, 8/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,

            // Rear
            -0.25, 0.25, 0.25, 24/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.25, 0.25, 0.25, 32/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.25, 0.25, -0.25, 32/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            0.25, 0.25, -0.25, 32/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.25, 0.25, -0.25, 24/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
            -0.25, 0.25, 0.25, 24/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,

            // Right
            -0.25, -0.25, 0.25, 16/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.25, 0.25, 0.25, 24/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.25, 0.25, -0.25, 24/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.25, 0.25, -0.25, 24/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.25, -0.25, -0.25, 16/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
            -0.25, -0.25, 0.25, 16/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,

            // Left
            0.25, -0.25, 0.25, 8/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.25, -0.25, -0.25, 8/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.25, 0.25, -0.25, 0/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.25, 0.25, -0.25, 0/64, 16/64, lm.r, lm.g, lm.b, lm.a, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.25, 0.25, 0.25, 0/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
            0.25, -0.25, 0.25, 8/64, 8/64, lm.r, lm.g, lm.b, lm.a, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,

        ];

        return this.playerHead = new GeometryTerrain(GeometryTerrain.convertFrom12(vertices));

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

        const a_pos = this.pos;

        // Draw head
        mat4.identity(modelMatrix);
        mat4.translate(modelMatrix, modelMatrix, [0, 0, this.height * options.scale - z_minus]);
        mat4.scale(modelMatrix, modelMatrix, [scale, scale, scale]);
        mat4.rotateZ(modelMatrix, modelMatrix, Math.PI - this.yaw);
        mat4.rotateX(modelMatrix, modelMatrix, -pitch);
        renderBackend.drawMesh(this.playerHead, material, a_pos, modelMatrix);

    }

}