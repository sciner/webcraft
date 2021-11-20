//@ts-check

import { SceneNode } from "./SceneNode.js";
import GeometryTerrain from "./geometry_terrain.js";
import glMatrix from "./../vendors/gl-matrix-3.3.min.js"

const { mat4, vec3, quat } = glMatrix;
const SCALE_RATIO = 1 / 16;

const computeMatrix = mat4.create();
const computePos = vec3.create();
const computePivot = vec3.create();
const computeScale = vec3.create();
const computeRot = quat.create();

const lm = {r : -1, g : -1, b : -1};
// let lm = {r : 0, g : 0, b : 0};
const ao = [0, 0, 0, 0];


function fillCube({
    matrix,
    size,
    textureSize,
    uvPoint = [0,0],
    mirror = false,
    inflate = 0
}, target) {
    // let xX = matrix[0], xY = matrix[1], xZ = matrix[2];
    // let yX = matrix[4], yY = matrix[5], yZ = matrix[6];
    // let zX = matrix[8], zY = matrix[9], zZ = matrix[10];


    let xX = matrix[0], xY = matrix[1], xZ = matrix[2];
    let yX = matrix[4], yY = matrix[5], yZ = matrix[6];
    let zX = matrix[8], zY = matrix[9], zZ = matrix[10];

    let tX = matrix[12], tY = matrix[13], tZ = matrix[14];

    const sx = uvPoint[0] / textureSize[0];
    const sy = uvPoint[1] / textureSize[1];
    const dx = size[0] / ( textureSize[0]);
    const dy = size[1] / ( textureSize[0]);
    const dz = size[2] / ( textureSize[0]);
    const flip = mirror ? -1 : 1;

    const flags = 0;

    // center of cube
    let cX = tX + (xX + yX + zX) * .5;
    let cY = tY + (xY + yY + zY) * .5;
    let cZ = tZ + (xZ + yZ + zZ) * .5;
    const inf2 = .5;

    inflate *= 2.0;
    xX += Math.sign(xX) * inflate;
    xY += Math.sign(xY) * inflate;
    xZ += Math.sign(xZ) * inflate;
    yX += Math.sign(yX) * inflate;
    yY += Math.sign(yY) * inflate;
    yZ += Math.sign(yZ) * inflate;
    zX += Math.sign(zX) * inflate;
    zY += Math.sign(zY) * inflate;
    zZ += Math.sign(zZ) * inflate;
    //                X                         Y                  w    h
    const topUV =    [sx + dz + dx / 2         , sy + dz / 2      , dx, dz];
    const bottomUV = [sx + dz + dx + dx / 2    , sy + dz / 2      , dx, dz];
    const northUV =  [sx + dz + dx / 2         , sy + dz + dy / 2 , dx, dy];
    const southUV =  [sx + 2 * dz + dx + dx / 2, sy + dz + dy / 2 , dx, dy];
    const eastUV =   [sx + dz + dx + dz / 2    , sy + dz + dy / 2 , dz, dy];
    const westUV =   [sx + dz / 2              , sy + dz + dy / 2 , dz, dy];
    //top
    let c = topUV;
    target.push(cX + inf2 * yX, cZ + inf2 * yZ, cY + inf2 * yY,
        xX, xZ, xY,
        zX, zZ, zY,
        c[0], c[1], c[2] * flip, c[3],
        lm.r, lm.g, lm.b,
        ...ao, flags);
    //bottom
    c = bottomUV;
    target.push(cX - inf2 * yX, cZ - inf2 * yZ, cY - inf2 * yY,
        xX, xZ, xY,
        -zX, -zZ, -zY,
        c[0], c[1], c[2] * flip, -c[3],
        lm.r, lm.g, lm.b,
        ...ao, flags);

    //north
    c = northUV;
    target.push(cX - inf2 * zX, cZ - inf2 * zZ, cY - inf2 * zY,
        xX, xZ, xY,
        yX, yZ, yY,
        c[0], c[1], c[2] * flip, -c[3],
        lm.r, lm.g, lm.b,
        ...ao, flags);

    //south
    c = southUV;
    target.push(cX + inf2 * zX, cZ + inf2 * zZ, cY + inf2 * zY,
        xX, xZ, xY,
        -yX, -yZ, -yY,
        c[0], c[1], -c[2] * flip, c[3],
        lm.r, lm.g, lm.b,
        ...ao, flags);

    //west
    c = mirror ? eastUV : westUV;
    target.push(cX - inf2 * xX, cZ - inf2 * xZ, cY - inf2 * xY,
        zX, zZ, zY,
        -yX, -yZ, -yY,
        c[0], c[1], -c[2] * flip, c[3],
        lm.r, lm.g, lm.b,
        ...ao, flags);

    //east
    c = mirror ? westUV : eastUV;
    target.push(cX + inf2 * xX, cZ + inf2 * xZ, cY + inf2 * xY,
        zX, zZ, zY,
        yX, yZ, yY,
        c[0], c[1], c[2] * flip, -c[3],
        lm.r, lm.g, lm.b,
        ...ao, flags);

    // target.push(...target2);

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

    for(let c of cubes) {
        const {
            origin = [0,0,0],
            size = [1,1,1],
            pivot = [0,0,0]
        } = c;

        vec3.set(computePivot,
            pivot[0] * SCALE_RATIO,
            pivot[1] * SCALE_RATIO,
            pivot[2] * SCALE_RATIO
        );

        vec3.set(computeScale,
            size[0] * SCALE_RATIO,
            size[1] * SCALE_RATIO,
            size[2] * SCALE_RATIO
        );

        vec3.set(computePos,
            (origin[0] - pivot[0]) * SCALE_RATIO,
            (origin[1] - pivot[1]) * SCALE_RATIO,
            (origin[2] - pivot[2]) * SCALE_RATIO
        );

        // interference
        computePos[0] += (0.5 - Math.random()) * 0.001;
        computePos[1] += (0.5 - Math.random()) * 0.001;
        computePos[2] += (0.5 - Math.random()) * 0.001;


        if (c.rotation) {
            quat.fromEuler(
                computeRot,
                c.rotation[0],
                c.rotation[1],
                -c.rotation[2] // WHY???
            );
        } else {
            computeRot.set([0,0,0,1])
        }

        mat4.fromRotationTranslationScale(
            computeMatrix,
            quat.create(),
            computePos,
            computeScale,
        );

        mat4.multiply(computeMatrix, mat4.fromQuat(mat4.create(), computeRot), computeMatrix);

        computeMatrix[12] += computePivot[0];
        computeMatrix[13] += computePivot[1];
        computeMatrix[14] += computePivot[2];


        fillCube({
                matrix: computeMatrix,
                uvPoint: c.uv,
                inflate: (c.inflate || 0) * SCALE_RATIO,
                size: size,
                textureSize: [description.texture_width, description.texture_height],
                mirror: c.mirror,
            },
            data
        );
    }

    return new GeometryTerrain(data);
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
            root.addChild(sceneNode);
        }

        sceneNode.source = node;
        sceneNode.name = node.name;

        if (node.cubes) {
            sceneNode.terrainGeometry = decodeCubes(node.cubes, description);
        }

        if (node.rotation) {
            // MAGIC, we MUST flip axis
            quat.fromEuler(
                sceneNode.quat,
                node.rotation[0],
                node.rotation[2],
                -node.rotation[1]
            )
        }

        if (node.pivot) {
            sceneNode.pivot.set([
                node.pivot[0] * SCALE_RATIO,
                node.pivot[2] * SCALE_RATIO,
                node.pivot[1] * SCALE_RATIO
            ]);
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