import { Building } from "../building.js";
import { BuilgingTemplate } from "../building_template.js";
import nico from "./data/nico.json" assert { type: "json" };

export class BuildingNico extends Building {

    static SIZE_LIST = [nico];

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