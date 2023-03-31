import type { Vector } from "../../helpers.js";
import type { Biome } from "../biome3/biomes.js";
import type { ClusterManager } from "./manager.js";
import { ClusterStructures, IStructureList } from "./structures.js";

const NETHER_STRUCTURE_LIST : IStructureList = [
    {chance: 1, schemas: [
        'nether_tower',
        'nether_portal',
        'nether_island'
    ]}
]

//
export class NetherClusterStructures extends ClusterStructures {

    constructor(clusterManager : ClusterManager, addr : Vector, biome : Biome) {
        super(clusterManager, addr, biome, NETHER_STRUCTURE_LIST)
    }

}