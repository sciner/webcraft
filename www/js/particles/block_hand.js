import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import { decodeCubes, fillCube } from "../bedrockJsonParser.js";
import GeometryTerrain from "../geometry_terrain.js";
import { Vector } from "../helpers.js";
import { Resources } from "../resources.js";

const {mat4} = glMatrix;

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

    constructor(skinId, render) {

        const { image, stive } = Particle_Hand.getSkinImage(skinId);
        this.texture = render.renderBackend.createTexture({
            source:  image,
            minFilter: 'nearest',
            magFilter: 'nearest',
            shared: true
        });

        this.material = render.defaultShader.materials.transparent.getSubMat(this.texture);
        
        this.modelMatrix = mat4.create();
        
        this.pos = new Vector(0, 0, 0);

        this.buffer = decodeCubes(
            {
                /**
                 * Stive hand
                 */
                "name": "RightArm",
                cubes: [
                    {
                        origin: [-2, 0, -5.5],
                        size: [stive ? 4 : 3, 12, 4],
                        uv: [40, 16],
                        rotation: [-90, 0, 0]
                    },
                ]
            },
            {
                texture_width: image.width,
                texture_height: image.height,
            }
        );

        mat4.scale(this.modelMatrix, this.modelMatrix, [1.5,1.5,1.5])
    }

    drawDirectly(render) {
        render.renderBackend.drawMesh(this.buffer, this.material, this.pos, this.modelMatrix);
    }

}