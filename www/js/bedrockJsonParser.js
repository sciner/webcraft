//@ts-check

import { NORMALS, Helpers } from './helpers.js';
import { SceneNode } from "./SceneNode.js";
import GeometryTerrain from "./geometry_terrain.js";

const {mat4, vec3, quat} = glMatrix;

const computeMatrix = mat4.create();
const computePos = vec3.create();
const computeScale = vec3.create();
const computeRot = quat.create();

const BOX_TEMPLATE = new Float32Array([
    // Top
    0.0, 0.0, 1.0, 8/64, 0, 0, 0, 0, 0, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
    1.0, 0.0, 1.0, 16/64, 0, 0, 0, 0, 0, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
    1.0, 1.0, 1.0, 16/64, 8/64, 0, 0, 0, 0, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
    1.0, 1.0, 1.0, 16/64, 8/64, 0, 0, 0, 0, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
    0.0, 1.0, 1.0, 8/64, 8/64, 0, 0, 0, 0, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
    0.0, 0.0, 1.0, 8/64, 0, 0, 0, 0, 0, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,

    // Bottom
    0.0, 0.0, 0.0, 16/64, 0, 0, 0, 0, 0, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
    0.0, 1.0, 0.0, 16/64, 8/64, 0, 0, 0, 0, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
    1.0, 1.0, 0.0, 24/64, 8/64, 0, 0, 0, 0, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
    1.0, 1.0, 0.0, 24/64, 8/64, 0, 0, 0, 0, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
    1.0, 0.0, 0.0, 24/64, 0, 0, 0, 0, 0, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,
    0.0, 0.0, 0.0, 16/64, 0, 0, 0, 0, 0, NORMALS.DOWN.x, NORMALS.DOWN.y, NORMALS.DOWN.z,

    // Front
    0.0, 0.0, 1.0, 8/64, 8/64, 0, 0, 0, 0, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
    0.0, 0.0, 0.0, 8/64, 16/64, 0, 0, 0, 0, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
    1.0, 0.0, 0.0, 16/64, 16/64, 0, 0, 0, 0, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
    1.0, 0.0, 0.0, 16/64, 16/64, 0, 0, 0, 0, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
    1.0, 0.0, 1.0, 16/64, 8/64, 0, 0, 0, 0, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,
    0.0, 0.0, 1.0, 8/64, 8/64, 0, 0, 0, 0, NORMALS.FORWARD.x, NORMALS.FORWARD.y, NORMALS.FORWARD.z,

    // Rear
    0.0, 1.0, 1.0, 24/64, 8/64, 0, 0, 0, 0, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
    1.0, 1.0, 1.0, 32/64, 8/64, 0, 0, 0, 0, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
    1.0, 1.0, 0.0, 32/64, 16/64, 0, 0, 0, 0, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
    1.0, 1.0, 0.0, 32/64, 16/64, 0, 0, 0, 0, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
    0.0, 1.0, 0.0, 24/64, 16/64, 0, 0, 0, 0, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,
    0.0, 1.0, 1.0, 24/64, 8/64, 0, 0, 0, 0, NORMALS.BACK.x, NORMALS.BACK.y, NORMALS.BACK.z,

    // Right
    0.0, 0.0, 1.0, 16/64, 8/64, 0, 0, 0, 0, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
    0.0, 1.0, 1.0, 24/64, 8/64, 0, 0, 0, 0, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
    0.0, 1.0, 0.0, 24/64, 16/64, 0, 0, 0, 0, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
    0.0, 1.0, 0.0, 24/64, 16/64, 0, 0, 0, 0, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
    0.0, 0.0, 0.0, 16/64, 16/64, 0, 0, 0, 0, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,
    0.0, 0.0, 1.0, 16/64, 8/64, 0, 0, 0, 0, NORMALS.RIGHT.x, NORMALS.RIGHT.y, NORMALS.RIGHT.z,

    // Left
    1.0, 0.0, 1.0, 8/64, 8/64, 0, 0, 0, 0, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
    1.0, 0.0, 0.0, 8/64, 16/64, 0, 0, 0, 0, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
    1.0, 1.0, 0.0, 0/64, 16/64, 0, 0, 0, 0, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
    1.0, 1.0, 0.0, 0/64, 16/64, 0, 0, 0, 0, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
    1.0, 1.0, 1.0, 0/64, 8/64, 0, 0, 0, 0, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,
    1.0, 0.0, 1.0, 8/64, 8/64, 0, 0, 0, 0, NORMALS.LEFT.x, NORMALS.LEFT.y, NORMALS.LEFT.z,

]);

function fillCube({ matrix, rot, pos, scale, uvPoint = [0,0], inflate = 0}, target) {
    const data = BOX_TEMPLATE.slice();
    const q = rot;

    for(let i = 0; i < 36 * 12; i += 12) {
        const pos = data.subarray(i, i + 3);
        const uv = data.subarray(i + 3, i + 5);
        const normal = data.subarray(i + 3 + 2 + 4, i + 3 + 2 + 4 + 3);

        pos[0] += inflate * normal[0];
        pos[1] += inflate * normal[1];
        pos[2] += inflate * normal[2];

        vec3.transformMat4(pos, pos, matrix);
        vec3.transformQuat(normal, normal, q);
        
        //const uvIndex = i / 12;
        //uv[0] = uvPoint[0];
        //uv[1] = uvPoint[1];
    }

    target.push(...data);
    return target;
}

/**
 * 
 * @param {IGeoCube[]} cubes 
 * @param {IGeoTreeDescription} description
 * @param {IVector} offset
 */
function decodeCubes(cubes, description, offset = null) {
    const data = [];

    computePos.set([0,0,0]);
    computeScale.set([1, 1, 1]);
    computeRot.set([0, 0, 0, 1]);

    for(let c of cubes) {
        c.origin && computePos.set(c.origin);
        c.size && computeScale.set(c.size);

        offset && vec3.subtract(computePos, computePos, offset);

        c.rotation && quat.fromEuler(computeRot, ...c.rotation);
 
        mat4.fromRotationTranslationScale(computeMatrix, computeRot, computePos, computeScale);
        //mat4.multiplyScalar(computeMatrix, computeMatrix, 1 / 36);

        fillCube({
                matrix: computeMatrix,
                uvPoint: [c.uv[0] / description.texture_width, c.uv[1] / description.texture_height],
                inflate: c.inflate,
                pos: computePos,
                rot: computeRot,
                scale: computeScale,
            },
            data
        );
    }

    return new GeometryTerrain(GeometryTerrain.convertFrom12(data));
}
/**
 * 
 * @param {IGeoFile | IGeoFileNew} json 
 */
export function decodeJsonGeometryTree(json) {
    /**
     * @type {IGeoTreeBones[]}
     */
    let bones;
    let name = '';
    /**
     * @type {IGeoTreeDescriptionNew}
     */
    let description;

    // new format
    if (json["minecraft:geometry"]) {
        bones = json["minecraft:geometry"][0].bones;
        description = json["minecraft:geometry"][0].description;
        name = description.identifier;
    } else {
        // old
        const id = Object.keys(json).filter(e => e !== 'format_version')[0];

        description = json[id];
        description.texture_height = description['textureheight'];
        description.texture_width = description['texturewidth'];
        bones = json[id].bones;
        name = id;
    }

    /**
     * @type {Record<string, SceneNode>}
     */
    const tree = {};
    const root = new SceneNode();

    root.name = name;
    root.source = json;

    for(let node of bones) {
        const sceneNode = new SceneNode();
 
        if (!node.parent) {
            quat.rotateX(sceneNode.quat, sceneNode.quat, Math.PI / 2);
            root.addChild(sceneNode);
        }

        sceneNode.source = node;
        sceneNode.name = node.name;

        if (node.cubes) {
            sceneNode.terrainGeometry = decodeCubes(node.cubes, description);
        }

        if (node.rotation) {
            quat.fromEuler(sceneNode.quat, ...node.rotation)
        }

        if (node.pivot) {
            sceneNode.pivot.set(node.pivot);
        }

        sceneNode.updateMatrix();

        tree[node.name] = sceneNode;
    }

    for(const key in tree) {
        const sceneNode = tree[key];

        if (sceneNode.source.parent) {
            tree[sceneNode.source.parent].addChild(sceneNode);
        }
    }

    return root;
}