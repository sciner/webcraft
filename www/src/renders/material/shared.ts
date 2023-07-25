import { MaterialGroup } from "./material_group.js";

export let MATERIAL_GROUPS = {
    regular: new MaterialGroup({ cullFace: true, opaque: true}),
    creative_regular: new MaterialGroup({ cullFace: true, opaque: true}),
    doubleface: new MaterialGroup({ cullFace: false, opaque: true}),
    decal1: new MaterialGroup({ cullFace: true, opaque: true, decalOffset: 1}),
    decal2: new MaterialGroup({ cullFace: true, opaque: true, decalOffset: 2}),
    doubleface_decal: new MaterialGroup({ cullFace: false, opaque: true, decalOffset: 3}),
    transparent: new MaterialGroup({ cullFace: true, opaque: false}),
    doubleface_transparent: new MaterialGroup({ cullFace: false, opaque: false}),
    label: new MaterialGroup({ cullFace: false, ignoreDepth: true}),
    fluid_doubleface: new MaterialGroup({cullFace: false, opaque: true, decalOffset: -2}),
    fluid_doubleface_transparent: new MaterialGroup({cullFace: false, opaque: false, decalOffset: -4}),
}

export const GROUPS_NO_TRANSPARENT = []
export const GROUPS_TRANSPARENT = []

function initGroups()
{
    for (let key in MATERIAL_GROUPS)
    {
        if (MATERIAL_GROUPS[key].opaque) {
            GROUPS_NO_TRANSPARENT.push(key);
        } else {
            GROUPS_TRANSPARENT.push(key);
        }
        MATERIAL_GROUPS[key].setName(key);
    }
}

initGroups();
