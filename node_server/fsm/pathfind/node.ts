import type { Vector } from "@client/helpers";

export class Node {
    
    #vector: Vector
    #g: number
    #h: number
    #node: Node

    constructor(vector: Vector, g: number, h: number, node: Node) {
        this.#vector = vector
        this.#g = g
        this.#h = h
        this.#node = node
    }

    get node() {
        return this.#node
    }

    get g(){
        return this.#g
    }

    get vector() {
        return this.#vector
    }

    getF() {
       return this.#g + this.#h;
    }

    get id() {
        return this.#vector.toHash()
    }
    
}