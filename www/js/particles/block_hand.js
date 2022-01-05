
import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import { decodeCubes, fillCube } from "../bedrockJsonParser.js";
import GeometryTerrain from "../geometry_terrain.js";
import { Vector } from "../helpers.js";
import { Resources } from "../resources.js";

const {mat4} = glMatrix;
const tmpMatrix = mat4.create();

/**
 * Model handler class for local player in-hand overlay
 */
export class Particle_Hand {

    static getSkinImage(id) {
        if (id in Resources.models['player:steve'].skins) {
            return  {
                image:  Resources.models['player:steve'].skins[id],
                stive: true,
            };
        }

        if (id in Resources.models['player:alex'].skins) {
            return  {
                image :Resources.models['player:alex'].skins[id],
                stive: false,
            }
        }

        return null;
    }

    /**
     * 
     * @param {string} skinId - id of skin, '1' by default
     * @param {Renderer} render 
     * @param {boolean} left - left arm style 
     */
    constructor(skinId, render, left = false) {

        const { image, stive } = Particle_Hand.getSkinImage(skinId);
        this.texture = render.renderBackend.createTexture({
            source:  image,
            minFilter: 'nearest',
            magFilter: 'nearest',
            shared: true
        });

        this.isLeft = left;

        this.material = render.defaultShader.materials.doubleface_transparent.getSubMat(this.texture);
        
        this.modelMatrix = mat4.create();
        
        this.pos = new Vector(0, 0, 0);
        const handData = {
            origin: [-2, 0, 2],
            size: [stive ? 4 : 3, 12, 4],
            uv: left ? [32, 48] : [40, 16],
            rotation: [0, 0, 0]
        };

        this.buffer = decodeCubes(
            {
                /**
                 * Stive hand
                 */
                "name": "RightArm",
                cubes: [
                    {
                        ...handData,
                    },
                    {
                        ...handData,
                        uv: left ? [48, 48] : [40, 32],
                        inflate: 0.25,
                    },
                ]
            },
            {
                texture_width: image.width,
                texture_height: image.height,
            }
        );

        mat4.scale(this.modelMatrix, this.modelMatrix, [1.5,1.5,1.5])
        mat4.rotateX(this.modelMatrix, this.modelMatrix, Math.PI / 2);
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, Math.PI);
        
    }

    /**
     * Push draw task directly without any pre-computation.
     * Any matrix updates should be applied manually
     * Allow prepend matrix to modelMatrix
     * @param {Rendere} render 
     * @param {mat4} prePendMatrix 
     */
    drawDirectly(render, prePendMatrix = null) {
        if (prePendMatrix) {
            mat4.mul(tmpMatrix, prePendMatrix, this.modelMatrix);
        }

        render.renderBackend.drawMesh(
            this.buffer,
            this.material,
            this.pos,
            prePendMatrix ? tmpMatrix : this.modelMatrix
        );
    }

}