import Biome3LayerStone from "./layers/stone.js";
import Biome3LayerLava from "./layers/lava.js";
import Biome3LayerAir from "./layers/air.js";
import Biome3LayerEnd from "./layers/end.js";
import Biome3LayerOverworld from "./layers/overworld.js";
import type { ChunkWorkerChunk } from "../../worker/chunk.js";
import type { Default_Terrain_Map } from "../default.js";
import Biome3LayerUnderworld from "./layers/underworld.js";
import type { Biome3LayerBase } from "./layers/base.js";
import type Terrain_Generator from "./index.js";
import Biome3LayerBottomCaves from "./layers/bottom_caves.js";
import Biome3LayerFlyingIslands from "./layers/flying_islands.js";

declare type ILayerList = {type: string, bottom: int, up: int}[]
declare type ILayerItem = {obj: Biome3LayerBase, bottom: int, up: int}

export class Biome3LayerManager {
    layer_types:        Map<any, any>
    layers:             any[]
    generator:          Terrain_Generator
    generator_options:  any
    min_y:              number
    max_y:              number
    opaque_layer:       ILayerItem
    transparent_layer:  ILayerItem

    constructor(generator : Terrain_Generator, list : ILayerList) {

        this.generator = generator
        this.generator_options = generator.world.generator.options

        this.layer_types = new Map()
        this.layer_types.set('underworld', Biome3LayerUnderworld)
        this.layer_types.set('overworld', Biome3LayerOverworld)
        this.layer_types.set('stone', Biome3LayerStone)
        this.layer_types.set('lava', Biome3LayerLava)
        this.layer_types.set('end', Biome3LayerEnd)
        this.layer_types.set('bottom_caves', Biome3LayerBottomCaves)
        this.layer_types.set('flying_island', Biome3LayerFlyingIslands)

        // Make layers
        this.makeLayers(list)

    }

    /**
     * Make layers
     */
    makeLayers(list : ILayerList) {

        this.layers = []
        this.min_y = Infinity
        this.max_y = -Infinity

        for(let item of list) {
            if(item.bottom < this.min_y) this.min_y = item.bottom
            if(item.up > this.max_y) this.max_y = item.up
            const cls = this.layer_types.get(item.type)
            if(!cls) throw `error_invalid_biome3_layer_type|${item.type}`
            const layer = new cls() as Biome3LayerBase
            layer.init(this.generator)
            this.layers.push({bottom: item.bottom, up: item.up, obj: layer})
        }

        const opaque_layer = this.generator_options.generate_big_caves ? new Biome3LayerLava() : new Biome3LayerStone()

        this.opaque_layer = {bottom: 0, up: 0, obj: opaque_layer.init(this.generator)}
        this.transparent_layer = {bottom: 0, up: 0, obj: new Biome3LayerAir().init(this.generator)}

    }

    getLayer(chunk : ChunkWorkerChunk) : ILayerItem {

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
        const CHUNK_SIZE_Y = chunk.size.y;

        const layer = this.getLayer(chunk)
        chunk.layer = layer.obj

        chunk.addr.y -= layer.bottom
        chunk.aabb.translate(0, -layer.bottom * CHUNK_SIZE_Y, 0)
        chunk.coord.y -= layer.bottom * CHUNK_SIZE_Y

        const is_lowest = chunk.addr.y == 0
        const is_highest = chunk.addr.y == (layer.up - layer.bottom) - 1

        const map = layer.obj.generate(chunk, chunk_seed, rnd, is_lowest, is_highest)

        chunk.addr.y += layer.bottom
        chunk.aabb.translate(0, layer.bottom * CHUNK_SIZE_Y, 0)
        chunk.coord.y += layer.bottom * CHUNK_SIZE_Y

        return map

    }

}