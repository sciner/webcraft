import Biome3LayerStone from "./layers/stone.js";
import Biome3LayerAir from "./layers/air.js";
import Biome3LayerOverworld from "./layers/overworld.js";
import { CHUNK_SIZE_Y } from "../../chunk_const.js";

export class Biome3LayerManager {

    constructor(generator) {
        
        this.generator = generator
        this.layers = []

        //
        this.min_y = Infinity
        this.max_y = -Infinity

        //
        this.layer_types = new Map()
        this.layer_types.set('overworld', Biome3LayerOverworld)
        this.layer_types.set('stone', Biome3LayerStone)

    }

    init(list) {

        for(let item of list) {
            if(item.bottom < this.min_y) this.min_y = item.bottom
            if(item.up > this.max_y) this.max_y = item.up
            const cls = this.layer_types.get(item.type)
            if(!cls) throw `error_invalid_biome3_layer_type|${item.type}`
            this.layers.push({bottom: item.bottom, up: item.up, obj: new cls(this.generator)})
        }

        this.opaque_layer = {bottom: 0, up: 0, obj: new Biome3LayerStone(this.generator)}
        this.transparent_layer = {bottom: 0, up: 0, obj: new Biome3LayerAir(this.generator)}

    }

    get(chunk) {

        if(chunk.addr.y < this.min_y) return this.opaque_layer
        if(chunk.addr.y > this.max_y) return this.transparent_layer

        for(let layer of this.layers) {
            if(chunk.addr.y >= layer.bottom && chunk.addr.y < layer.up) {
                return layer
            }
        }

        return this.transparent_layer

    }

    generateChunk(chunk, chunk_seed, rnd) {
        
        const layer = this.get(chunk)
        chunk.layer = layer.obj

        chunk.addr.y -= layer.bottom
        chunk.coord.y -= layer.bottom * CHUNK_SIZE_Y

        const map = layer.obj.generate(chunk, chunk_seed, rnd)

        chunk.addr.y += layer.bottom
        chunk.coord.y += layer.bottom * CHUNK_SIZE_Y

        return map

    }

}