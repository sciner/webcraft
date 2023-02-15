import { SceneNode } from "./SceneNode.js";
import { decodeJsonGeometryTree } from "./bedrockJsonParser.js";
import GeometryTerrain from "./geometry_terrain.js";

export function fromGltfNode(gltf) {
    const node = new SceneNode();

    node.source = gltf;
    node.matrix = gltf.matrix;
    node.name = gltf.name;

    if (node.name.indexOf('.') > -1) {
        node.name = node.name.split('.')[0];
    }

    for (const child of gltf.children) {
        const childNode = fromGltfNode(child);
        childNode.parent = node;

        node.children.push(childNode);
    }

    let geom = gltf.terrainGeometry;
    if (gltf.mesh && gltf.mesh.interlivedData && !geom) {
        geom = gltf.terrainGeometry = new GeometryTerrain(GeometryTerrain.convertFrom12(gltf.mesh.interlivedData));
    }

    node.terrainGeometry = geom;

    return node;
}

export const fromJson = decodeJsonGeometryTree

/**
 * Load model from any supported type
 * @param {{type: string}} data 
 * @returns {SceneNode}
 */
export function loadModel(data) {
    if (data.type === 'json') {
        return decodeJsonGeometryTree(data);
    }

    console.log('Model loader not exist for type:', data.type);
}