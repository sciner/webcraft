import { Building } from "../building.js";

// 
export class BuildingBlocks extends Building {

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
     * @param {*} map
     */
    draw(cluster, chunk, map) {
        super.draw(cluster, chunk, this.random_building.getMeta('draw_natural_basement', true))
        this.blocks.draw(cluster, chunk, map)
    }

}