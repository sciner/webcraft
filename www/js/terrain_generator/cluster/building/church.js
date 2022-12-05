import { Building } from "../building.js";

import church from "./data/church.json" assert { type: "json" };

// Church
export class Church extends Building {

    static SIZE_LIST = [church];

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