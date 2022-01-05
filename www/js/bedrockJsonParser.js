//@ts-check

import { SceneNode } from "./SceneNode.js";
import GeometryTerrain from "./geometry_terrain.js";
import glMatrix from "./../vendors/gl-matrix-3.3.min.js"

const { mat4, vec3, quat } = glMatrix;
const SCALE_RATIO = 1 / 16;
const Z_FIGHT_OFFSET = 0.0005;

const computeMatrix = mat4.create();
const computePos = vec3.create();
const computePivot = vec3.create();
const computeScale = vec3.create();
const computeRot = quat.create();

const lm = {r : -1, g : -1, b : -1};

/**
 * Fill cube from bedrock cube notation
 * @param {*} param0 
 * @param {*} target 
 * @returns 
 */
export function fillCube({
    matrix,
    size,
    textureSize,
    uvPoint = [0,0],
    mirror = false,
    inflate = 0
}, target) {

    let xX = matrix[0], xY = matrix[1], xZ = matrix[2];
    let yX = matrix[4], yY = matrix[5], yZ = matrix[6];
    let zX = matrix[8], zY = matrix[9], zZ = matrix[10];

    let tX = matrix[12], tY = matrix[13], tZ = matrix[14];

    const itx = 1 / textureSize[0];
    const ity = 1 / textureSize[1];

    // const [ sx, sy ] = uvPoint;
    const [ dx, dy, dz ] = size;
    const uv = {
        north: [],
        east : [],
        south: [],
        west : [],
        up   : [],
        down : []
    };

    // old format, where uvPoint is  [x, y] which represent block of start cube-layout
    if(Array.isArray(uvPoint)) {
        // UV
        //                X                                                Y                                      w         h
        uv.up    =  [itx * (uvPoint[0] + dz + dx / 2),            ity * (uvPoint[1] + dz / 2),       dx * itx, dz * ity];
        uv.down  =  [itx * (uvPoint[0] + dz + dx + dx / 2),       ity * (uvPoint[1] + dz / 2),       dx * itx, dz * ity];
        uv.north =  [itx * (uvPoint[0] + dz + dx / 2),            ity * (uvPoint[1] + dz + dy / 2),  dx * itx, dy * ity];
        uv.south =  [itx * (uvPoint[0] + 2 * dz + dx + dx / 2),   ity * (uvPoint[1] + dz + dy / 2),  dx * itx, dy * ity];
        uv.east  =  [itx * (uvPoint[0] + dz + dx + dz / 2),       ity * (uvPoint[1] + dz + dy / 2),  dz * itx, dy * ity];
        uv.west  =  [itx * (uvPoint[0] + dz / 2),                 ity * (uvPoint[1] + dz + dy / 2),  dz * itx, dy * ity];

    //uv each direction
    } else {
        for(const key in uv) {
            uv[key] = [
                (uvPoint[key].uv[0] + uvPoint[key].uv_size[0] / 2) * itx,
                (uvPoint[key].uv[1] + uvPoint[key].uv_size[1] / 2) * ity,
                uvPoint[key].uv_size[0] * itx,
                uvPoint[key].uv_size[1] * ity
            ]
        }
    }

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

    let c;

    // when size by any axes is zero we drop quads that based on this axis
    if (dx * dz > 0) {
        //up
        c = uv.up;
        target.push(cX + inf2 * yX, cZ + inf2 * yZ, cY + inf2 * yY,
            xX, xZ, xY,
            zX, zZ, zY,
            c[0], c[1], c[2] * flip, -c[3],
            lm.r, lm.g, lm.b, flags);
        
        //down
        c = uv.down;
        target.push(cX - inf2 * yX, cZ - inf2 * yZ, cY - inf2 * yY,
            xX, xZ, xY,
            -zX, -zZ, -zY,
            c[0], c[1], c[2] * flip, -c[3],
            lm.r, lm.g, lm.b, flags);

    }

    if (dx * dz > 0) {
        //north
        c = uv.north;
        target.push(cX - inf2 * zX, cZ - inf2 * zZ, cY - inf2 * zY,
            xX, xZ, xY,
            yX, yZ, yY,
            c[0], c[1], c[2] * flip, -c[3],
            lm.r, lm.g, lm.b, flags);

        //south
        c = uv.south;
        target.push(cX + inf2 * zX, cZ + inf2 * zZ, cY + inf2 * zY,
            xX, xZ, xY,
            -yX, -yZ, -yY,
            c[0], c[1], -c[2] * flip, c[3],
            lm.r, lm.g, lm.b, flags);
    }

    if (dy * dz > 0) {
        //west
        c = mirror ? uv.east : uv.west;
        target.push(cX - inf2 * xX, cZ - inf2 * xZ, cY - inf2 * xY,
            zX, zZ, zY,
            -yX, -yZ, -yY,
            c[0], c[1], -c[2] * flip, c[3],
            lm.r, lm.g, lm.b, flags);

        //east
        c = mirror ? uv.west : uv.east;
        target.push(cX + inf2 * xX, cZ + inf2 * xZ, cY + inf2 * xY,
            zX, zZ, zY,
            yX, yZ, yY,
            c[0], c[1], c[2] * flip, -c[3],
            lm.r, lm.g, lm.b, flags);
    }
 
    return target;
}

/**
 *
 * @param {IGeoTreeBones} bone
 * @param {IGeoTreeDescription} description
 */
export function decodeCubes(bone, description) {
    const data = [];
    // only for 1.8 should apply flip
    const offset = bone.bind_pose_rotation ? bone.pivot : null;
    const flipX = !!bone.bind_pose_rotation ? -1 : 1;

    for(let c of bone.cubes) {
        const {
            origin = [0,0,0],
            size = [1,1,1],
            pivot = offset || [0,0,0]
        } = c;

        vec3.set(computePivot,
            pivot[0] * SCALE_RATIO,
            pivot[1] * SCALE_RATIO,
            pivot[2] * SCALE_RATIO
        );

        // set scale by keep offset when scale is 0 to prevent z-fight
        vec3.set(computeScale,
            size[0] * SCALE_RATIO || Z_FIGHT_OFFSET,
            size[1] * SCALE_RATIO || Z_FIGHT_OFFSET,
            size[2] * SCALE_RATIO || Z_FIGHT_OFFSET
        );

        vec3.set(computePos,
            (origin[0] - pivot[0]) * SCALE_RATIO,
            (origin[1] - pivot[1]) * SCALE_RATIO,
            (origin[2] - pivot[2]) * SCALE_RATIO
        );

        // interference
        computePos[0] += (0.5 - Math.random()) * Z_FIGHT_OFFSET;
        computePos[1] += (0.5 - Math.random()) * Z_FIGHT_OFFSET;
        computePos[2] += (0.5 - Math.random()) * Z_FIGHT_OFFSET;

        const rot = c.rotation || bone.bind_pose_rotation;
        if (rot) {
            quat.fromEuler(
                computeRot,
                flipX * rot[0],
                rot[1],
                -rot[2] // WHY???
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
                mirror: c.mirror || bone.mirror,
            },
            data
        );
    }

    return new GeometryTerrain(data);
}
/**
 *
 */
export function decodeJsonGeometryTree(json, variant = null) {
    variant = variant || json.variant || 0;
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
        /**
         * @type {IGeoTreeNew[]}
         */
        const blob = json["minecraft:geometry"];
        const dataset = (
            variant 
                ? (typeof variant === "number" 
                    ? blob[variant] 
                    : blob.find(e => e.description.identifier === variant))
                : blob[0]
            ) || blob[0];
            
        bones = dataset.bones;
        description = dataset.description;
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
            sceneNode.terrainGeometry = node.terrainGeometry || decodeCubes(
                node,
                description,
            );

            // store already parsed geometry for node
            node.terrainGeometry = sceneNode.terrainGeometry;
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