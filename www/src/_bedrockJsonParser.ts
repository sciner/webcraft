//@ts-check

// import { SceneNode } from "./SceneNode.js";
// import { GeometryTerrain } from "./geometry_terrain.js";
// import glMatrix from "@vendors/gl-matrix-3.3.min.js"

// /**
//  * @typedef {Object} UVDefinition
//  * @property {number[]} uv
//  * @property {number[]} uv_size
//  */

// /**
//  * @typedef {Object} UVDirections
//  * @property {UVDefinition} north
//  * @property {UVDefinition} south
//  * @property {UVDefinition} east
//  * @property {UVDefinition} west
//  * @property {UVDefinition} up
//  * @property {UVDefinition} down
//  */

// /**
//  * @typedef {Object} FillCubeOptions
//  * @property {*} matrix
//  * @property {number[]} size (float[3])
//  * @property {number[]} textureSize (float[2])
//  * @property {boolean} mirror
//  * @property {number} inflate (Float)
//  * @property {number[] | UVDefinition | UVDirections} uv
//  */

// const { mat4, vec3, quat } = glMatrix;
// const SCALE_RATIO = 1 / 16;
// const Z_FIGHT_OFFSET = 0.0005;

// const computeMatrix = mat4.create();
// const computePos = vec3.create();
// const computePivot = vec3.create();
// const computeScale = vec3.create();
// const computeRot = quat.create();

// const lm = 0;

// /**
//  * Fill cube from bedrock cube notation.
//  *
//  * @param {FillCubeOptions} param0
//  * @param {*} target
//  * @returns
//  */
// export function fillCube({
//     matrix,
//     size,
//     textureSize,
//     uv = [0,0] as (tupleFloat2 | Dict),
//     mirror = false,
//     inflate = 0
// }, target) {
//     let xX = matrix[0], xY = matrix[1], xZ = matrix[2];
//     let yX = matrix[4], yY = matrix[5], yZ = matrix[6];
//     let zX = matrix[8], zY = matrix[9], zZ = matrix[10];

//     let tX = matrix[12], tY = matrix[13], tZ = matrix[14];

//     const itx = 1 / textureSize[0];
//     const ity = 1 / textureSize[1];

//     // const [ sx, sy ] = uvPoint;
//     const [ dx, dy, dz ] = size;
//     const uvSides = {
//         north: [],
//         east : [],
//         south: [],
//         west : [],
//         up   : [],
//         down : []
//     };

//     // old format, where uvPoint is  [x, y] which represent block of start cube-layout
//     if(Array.isArray(uv)) {
//         // UV
//         //           X                                             Y                                   W         H
//         uvSides.up    =  [itx * (uv[0] + dz + dx / 2),            ity * (uv[1] + dz / 2),       dx * itx, dz * ity];
//         uvSides.down  =  [itx * (uv[0] + dz + dx + dx / 2),       ity * (uv[1] + dz / 2),       dx * itx, dz * ity];
//         uvSides.north =  [itx * (uv[0] + dz + dx / 2),            ity * (uv[1] + dz + dy / 2),  dx * itx, dy * ity];
//         uvSides.south =  [itx * (uv[0] + 2 * dz + dx + dx / 2),   ity * (uv[1] + dz + dy / 2),  dx * itx, dy * ity];
//         uvSides.east  =  [itx * (uv[0] + dz + dx + dz / 2),       ity * (uv[1] + dz + dy / 2),  dz * itx, dy * ity];
//         uvSides.west  =  [itx * (uv[0] + dz / 2),                 ity * (uv[1] + dz + dy / 2),  dz * itx, dy * ity];

//     // uv each direction
//     } else {
//         const uv_point = uv as Dict
//         for(const key in uvSides) {
//             if(!uv_point[key]) {
//                 continue
//             }
//             const [x, y] = uv_point[key].uv;
//             const [width, height] = uv_point[key].uv_size;

//             uvSides[key] = [
//                 (x + width / 2) * itx,  // Center X
//                 (y + height / 2) * ity, // Center Y
//                 width * itx,            // Width
//                 height * ity            // Height
//             ]
//         }
//     }

//     const flip = mirror ? -1 : 1;

//     const flags = 0;

//     // center of cube
//     let cX = tX + (xX + yX + zX) * .5;
//     let cY = tY + (xY + yY + zY) * .5;
//     let cZ = tZ + (xZ + yZ + zZ) * .5;
//     const inf2 = .5;

//     inflate *= 2.0;
//     xX += Math.sign(xX) * inflate;
//     xY += Math.sign(xY) * inflate;
//     xZ += Math.sign(xZ) * inflate;

//     yX += Math.sign(yX) * inflate;
//     yY += Math.sign(yY) * inflate;
//     yZ += Math.sign(yZ) * inflate;

//     zX += Math.sign(zX) * inflate;
//     zY += Math.sign(zY) * inflate;
//     zZ += Math.sign(zZ) * inflate;

//     let c;

//     // when size by any axes is zero we drop quads that based on this axis
//     if (dx * dz > 0) {
//         //up
//         c = uvSides.up;
//         target.push(cX + inf2 * yX, cZ + inf2 * yZ, cY + inf2 * yY,
//             xX, xZ, xY,
//             zX, zZ, zY,
//             c[0], c[1], c[2] * flip, -c[3],
//             lm, flags);

//         //down
//         c = uvSides.down;
//         target.push(cX - inf2 * yX, cZ - inf2 * yZ, cY - inf2 * yY,
//             xX, xZ, xY,
//             -zX, -zZ, -zY,
//             c[0], c[1], c[2] * flip, -c[3],
//             lm, flags);

//     }

//     if (dx * dy > 0) {
//         //north
//         c = uvSides.north;
//         target.push(cX - inf2 * zX, cZ - inf2 * zZ, cY - inf2 * zY,
//             xX, xZ, xY,
//             yX, yZ, yY,
//             c[0], c[1], c[2] * flip, -c[3],
//             lm, flags);

//         //south
//         c = uvSides.south;
//         target.push(cX + inf2 * zX, cZ + inf2 * zZ, cY + inf2 * zY,
//             xX, xZ, xY,
//             -yX, -yZ, -yY,
//             c[0], c[1], -c[2] * flip, c[3],
//             lm, flags);
//     }

//     if (dy * dz > 0) {
//         //west
//         c = mirror ? uvSides.east : uvSides.west;
//         target.push(cX - inf2 * xX, cZ - inf2 * xZ, cY - inf2 * xY,
//             zX, zZ, zY,
//             -yX, -yZ, -yY,
//             c[0], c[1], -c[2] * flip, c[3],
//             lm, flags);

//         //east
//         c = mirror ? uvSides.west : uvSides.east;
//         target.push(cX + inf2 * xX, cZ + inf2 * xZ, cY + inf2 * xY,
//             zX, zZ, zY,
//             yX, yZ, yY,
//             c[0], c[1], c[2] * flip, -c[3],
//             lm, flags);
//     }

//     return target;
// }

// /**
//  * @param {IGeoTreeBones} bone
//  * @param {IGeoTreeDescription} description
//  */
//  export function decodeCubes(bone, description) {
//     const data = [];
//     // only for 1.8 should apply flip
//     const offset = bone.bind_pose_rotation ? bone.pivot : null;
//     const flipX = !!bone.bind_pose_rotation ? -1 : 1;

//     for(let cube of bone.cubes) {
//         const {
//             origin = [0,0,0],
//             size = [1,1,1],
//             pivot = offset || [0,0,0]
//         } = cube;

//         vec3.set(computePivot,
//             pivot[0] * SCALE_RATIO,
//             pivot[1] * SCALE_RATIO,
//             pivot[2] * SCALE_RATIO
//         );

//         const inf = (cube.inflate || 0);

//         // set scale by keep offset when scale is 0 to prevent z-fight
//         vec3.set(computeScale,
//             (size[0] + inf * 2) * SCALE_RATIO || Z_FIGHT_OFFSET,
//             (size[1] + inf * 2) * SCALE_RATIO || Z_FIGHT_OFFSET,
//             (size[2] + inf * 2) * SCALE_RATIO || Z_FIGHT_OFFSET
//         );

//         vec3.set(computePos,
//             (origin[0] - pivot[0] - inf) * SCALE_RATIO,
//             (origin[1] - pivot[1] - inf) * SCALE_RATIO,
//             (origin[2] - pivot[2] - inf) * SCALE_RATIO
//         );

//         // interference
//         computePos[0] += (0.5 - Math.random()) * Z_FIGHT_OFFSET;
//         computePos[1] += (0.5 - Math.random()) * Z_FIGHT_OFFSET;
//         computePos[2] += (0.5 - Math.random()) * Z_FIGHT_OFFSET;

//         const rot = cube.rotation || bone.bind_pose_rotation;
//         if (rot) {
//             quat.fromEuler(
//                 computeRot,
//                 flipX * rot[0],
//                 rot[1],
//                 -rot[2] // WHY???
//             );
//         } else {
//             computeRot.set([0,0,0,1])
//         }

//         mat4.fromRotationTranslationScale(
//             computeMatrix,
//             quat.create(),
//             computePos,
//             computeScale,
//         );

//         mat4.multiply(computeMatrix, mat4.fromQuat(mat4.create(), computeRot), computeMatrix);

//         computeMatrix[12] += computePivot[0];
//         computeMatrix[13] += computePivot[1];
//         computeMatrix[14] += computePivot[2];

//         let uv;
//         if(cube.uv['north']) {
//             uv = {
//                 north: cube.uv.north,
//                 south: cube.uv.south,

//                 // I swap these two because it corrects the result. -Jab
//                 east: cube.uv.west,
//                 west: cube.uv.east,

//                 up: cube.uv.up,
//                 down: cube.uv.down
//             };
//         } else if(cube.uv_size) {
//             uv = {
//                 uv: cube.uv,
//                 uv_size: cube.uv_size
//             };
//         } else if(Object.keys(cube.uv).length === 0) {
//             uv = [0, 0];
//         } else {
//             uv = cube.uv;
//         }


//         fillCube({
//                 matrix: computeMatrix,
//                 uv,
//                 inflate: 0,
//                 size: size,
//                 textureSize: [description.texture_width, description.texture_height],
//                 mirror: cube.mirror || bone.mirror,
//             },
//             data
//         );
//     }

//     return new GeometryTerrain(data);
// }
// /**
//  *
//  */
// export function decodeJsonGeometryTree(json, variant = null) {
//     variant = variant || json.variant || 0;
//     /**
//      * @type {IGeoTreeBones[]}
//      */
//     let geometries = [];
//     // let bones = [];
//     // let name = '';
//     /**
//      * @type {IGeoTreeDescriptionNew}
//      */
//     // let description;

//     // new format
//     if (json["minecraft:geometry"]) {
//         /**
//          * @type {IGeoTreeNew[]}
//          */
//         const blob = json["minecraft:geometry"];
//         const dataset = (
//             variant
//                 ? (typeof variant === "number"
//                     ? blob[variant]
//                     : blob.find(e => e.description.identifier === variant))
//                 : blob[0]
//             ) || blob[0];
//         geometries.push({
//             bones:          dataset.bones,
//             description:    dataset.description,
//             name:           dataset.description.identifier
//         });
//     } else {
//         // old
//         const ids = Object.keys(json).filter(e => ['format_version', 'type'].indexOf(e) < 0);
//         for(let id of ids) {
//             const description = json[id];
//             if(typeof description == 'object') {
//                 if('bones' in description) {
//                     // texture width
//                     if('texturewidth' in description) {
//                         description.texture_width = description['texturewidth'];
//                     } else {
//                         throw 'texturewidth not found';
//                     }
//                     // texture height
//                     if('textureheight' in description) {
//                         description.texture_height = description['textureheight'];
//                     } else {
//                         throw 'textureheight not found';
//                     }
//                     //
//                     geometries.push({
//                         bones:          description.bones,
//                         description:    description,
//                         name:           id
//                     });
//                 }
//             }
//         }
//     }

//     const roots = [];

//     for(let geom of geometries) {

//         /**
//          * @type {Record<string, SceneNode>}
//          */
//         const tree = {};
//         const root = new SceneNode();

//         root.name = geom.name;
//         root.source = json;

//         for(let node of geom.bones) {

//             if('visible' in node && !node.visible)  {
//                 continue;
//             }

//             // TODO: Hmm...
//             if(json.format_version == '1.10.0') {
//                 if(node.rotation && node.rotation[2] != 0) {
//                     node.bind_pose_rotation = node.rotation
//                     delete(node.rotation)
//                 }
//             }

//             // BlockBench-generated boundary-box cube.
//             if(node.name === 'bb_main') {
//                 continue;
//             }

//             const sceneNode = new SceneNode();

//             if (!node.parent) {
//                 root.addChild(sceneNode);
//             }

//             sceneNode.source = node;
//             sceneNode.name = node.name;

//             if (node.cubes) {
//                 sceneNode.terrainGeometry = node.terrainGeometry || decodeCubes(
//                     node,
//                     geom.description,
//                 );

//                 // store already parsed geometry for node
//                 node.terrainGeometry = sceneNode.terrainGeometry;
//             }

//             if (node.scale) {
//                 vec3.set(sceneNode.scale, node.scale[0], node.scale[1], node.scale[2]);
//             }

//             if (node.rotation) {
//                 // MAGIC, we MUST flip axis
//                 quat.fromEuler(
//                     sceneNode.quat,
//                     node.rotation[0],
//                     node.rotation[2],
//                     -node.rotation[1]
//                 )
//             }

//             if (node.pivot) {
//                 sceneNode.pivot.set([
//                     node.pivot[0] * SCALE_RATIO,
//                     node.pivot[2] * SCALE_RATIO,
//                     node.pivot[1] * SCALE_RATIO
//                 ]);
//             }

//             if(node.name in tree) {
//                 tree[node.name].addChild(sceneNode);
//                 sceneNode.updateMatrix();
//             } else {
//                 tree[node.name] = sceneNode;
//                 sceneNode.updateMatrix();
//             }

//         }

//         for(const key in tree) {
//             const sceneNode = tree[key];
//             if (sceneNode.source.parent) {
//                 tree[sceneNode.source.parent].addChild(sceneNode);
//             }
//         }

//         roots.push(root);
//     }


//     return roots;
// }
