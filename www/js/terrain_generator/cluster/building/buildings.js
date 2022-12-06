import { Building } from "../building.js";

import domikder from "./data/domikder.json" assert { type: "json" };
import domikkam from "./data/domikkam.json" assert { type: "json" };

// BuildingS (small)
export class BuildingS extends Building {

    static SIZE_LIST = [domikder, domikkam];

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size, random_building) {
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size, random_building);
    }

    //
    addBlocks() {
        const random_building = this.random_building;
        this.blocks.list.push(...random_building.rot[this.direction])
    }

    /**
     * @param { import("../base.js").ClusterBase } cluster
     * @param {*} chunk 
     */
    draw(cluster, chunk) {
        super.draw(cluster, chunk);
        this.blocks.draw(cluster, chunk);
    }

}