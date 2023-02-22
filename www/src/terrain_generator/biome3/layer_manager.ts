import Biome3LayerStone from "./layers/stone.js";
import Biome3LayerLava from "./layers/lava.js";
import Biome3LayerAir from "./layers/air.js";
import Biome3LayerOverworld from "./layers/overworld.js";
import { CHUNK_SIZE_Y } from "../../chunk_const.js";
import type { ChunkWorkerChunk } from "../../worker/chunk.js";
import type { Default_Terrain_Map } from "../default.js";

export class Biome3LayerManager {
    [key: string]: any;

    constructor(generator, list) {
        
        this.generator = generator
        this.generator_options = generator.world.generator.options

        this.layer_types = new Map()
        this.layer_types.set('overworld', Biome3LayerOverworld)
        this.layer_types.set('stone', Biome3LayerStone)
        this.layer_types.set('lava', Biome3LayerLava)

        // Make layers
        this.makeLayers(list)

    }

    /**
     * Make layers
     * @param {*} list 
     */
    makeLayers(list) {

        this.layers = []
        this.min_y = Infinity
        this.max_y = -Infinity

        for(let item of list) {
            if(item.bottom < this.min_y) this.min_y = item.bottom
            if(item.up > this.max_y) this.max_y = item.up
            const cls = this.layer_types.get(item.type)
            if(!cls) throw `error_invalid_biome3_layer_type|${item.type}`
            this.layers.push({bottom: item.bottom, up: item.up, obj: new cls(this.generator)})
        }

        this.opaque_layer = {bottom: 0, up: 0, obj: this.generator_options.generate_big_caves ? new Biome3LayerLava(this.generator) : new Biome3LayerStone(this.generator)}
        this.transparent_layer = {bottom: 0, up: 0, obj: new Biome3LayerAir(this.generator)}

    }

    getLayer(chunk : ChunkWorkerChunk) {

        if(chunk.addr.y < this.min_y) return this.opaque_layer
        if(chunk.addr.y > this.max_y) return this.transparent_layer

        for(let layer of this.layers) {
            if(chunk.addr.y >= layer.bottom && chunk.addr.y < layer.up) {
                return layer
            }
        }

        return this.transparent_layer

    }

    generateChunk(chunk : ChunkWorkerChunk, chunk_seed : string, rnd : any) : Default_Terrain_Map {
        
        const layer = this.getLayer(chunk)
        chunk.layer = layer.obj

        chunk.addr.y -= layer.bottom
        chunk.coord.y -= layer.bottom * CHUNK_SIZE_Y

        const map = layer.obj.generate(chunk, chunk_seed, rnd)

        chunk.addr.y += layer.bottom
        chunk.coord.y += layer.bottom * CHUNK_SIZE_Y

        return map

    }

}