import GeometryTerrain from "./geometry_terrain.js";
import {NORMALS, Helpers} from './helpers.js';
import {Resources} from "./resources.js";

const {mat4} = glMatrix;
const computeMatrix = mat4.create();

export class MobModel {

    constructor(props) {

        this.type = props.type;
        this.gltfAsset                  = null;
        this.texPlayer                  = null;
        this.texPlayer2                 = null;

        this.matPlayer = null;
        this.matPlayer2 = null;

        this.moving_timeout             = null;
        this.texture                    = null;
        this.nametag                    = null;
        this.moving                     = false;
        this.aniframe                   = 0;
        this.height                     = 0;

        this.modelMatrix                = mat4.create();

        this.skin = {
            file: '/media/skins/16.png'
        };

        Object.assign(this, props);

    }

    traverse(node, cb, parent = null, args = {}) {
        if(!cb.call(this, node, parent, args)) {
            return false;
        }

        for(let next of node.children) {
            if (!this.traverse(next, cb, node, args)) return false;
        }

        return true;
    }

    // draw
    draw(render, camPos, delta) {
        const gl = this.gl = render.gl;
        this.drawLayer(render, camPos, delta, {
            scale:          .25,
            material:       this.matPlayer,
            draw_nametag:   false
        });
        /*
        this.drawLayer(render, camPos, delta, {
            scale:          1.05,
            material:       this.matPlayer2,
            draw_nametag:   true
        });
        */
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
        if (this.texPlayer && this.texPlayer2) {
            return;
        }

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
                        })
                });
            });

    }

    // Loads the player head model into a vertex buffer for rendering.
    loadPlayerHeadModel() {
        const node = Resources.models[this.type.replace('mob_','')] || Resources.models['70'];

        const clone = (node, parent = null) => {
            const children = [];

            for(const child of node.children) {
                children.push(clone(child, parent));
            }

            let geom = node.terrainGeometry;

            if (node.mesh && node.mesh.interlivedData && !geom) {
                geom = node.terrainGeometry =  new GeometryTerrain(GeometryTerrain.convertFrom12(node.mesh.interlivedData))
            }

            return {
                name: node.name,
                matrix: mat4.clone(node.matrix),
                worldMatrix: mat4.create(),
                terrainGeometry: geom,
                needUpdateMatrix: true,
                children,
            }
        }

        return this.gltfAsset = clone(node, null);
    }

    drawTraversed(node, parent, {render, material}) {
        if (parent) {
            mat4.multiply(node.worldMatrix, parent.worldMatrix, node.matrix);
        }

        if (!node.terrainGeometry) {
            return true;
        }


        if (node.name !== 'body') {
            //return true;
        }

        render.renderBackend.drawMesh(node.terrainGeometry, material, this.pos, node.worldMatrix);

        return true;
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
        if(!this.gltfAsset) {
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

        this.gltfAsset.worldMatrix = modelMatrix;
        this.gltfAsset.needUpdateMatrix = false;

        this.traverse(this.gltfAsset, this.drawTraversed, null, {render, material});
    }

}