import { Vector } from "@client/helpers.js";
import type { AI } from "fsm/ai";
import { Node } from "./node";
import { FLUID_TYPE_MASK, FLUID_WATER_ID } from "@client/fluid/FluidConst.js";

const MAX_NODES = 200
const MAX_TIME_DOWN = 30

export class PathNavigate {

    #ai: AI
    #can_swim: boolean
    #opened: any
    #closed: any
    #found: boolean
    #count: number
    #path: any
    #timer_wall: number

    constructor(ai: AI) {
        this.#ai = ai
        this.#opened = new Map()
        this.#closed = new Map()
        this.#can_swim = true
    }

    // очитска пути
    clearPath() {
        this.#path = null
    }
    // получение пути
    getPath() {
        return this.#path
    }
    // установка пути
    setPath(path) {
        if (!path) {
            return false
        }
        this.#path = path
        this.#timer_wall = 0
        return true
    }
    // двигаться к точке
    tryMoveToPos(pos: Vector, speed: number) {
        const path = this.getPathToPos(pos);
        return this.setPath(path);
    }

    // получаем путь от моба до точки
    getPathToPos(position: Vector) {
        this.#opened.clear()
        this.#closed.clear()
        this.#found = false
        this.#count = 0
        const mob = this.#ai.mob
        const pos = mob.pos.floored()
        const target = position.floored()
        const node = new Node(pos, 0, this.getDistance(pos, target), null)
        this.#opened.set(node.id, node)
        this.closeNode(node, target)
        if (!this.#found) {
            return null
        }
        // @todo костыль
        const clear_nodes = [Array.from(this.#closed).at(-1)[1]]
        for (let i = 0; i < 500; i++) {
            const t = clear_nodes.at(-1).node
            if (t == null) {
                break
            }
            clear_nodes.push(t)
        }
        return clear_nodes.reverse()
    }

    // длина пути из точки а в точку б
    getDistance(a: Vector, b: Vector) {
        const dis = a.sub(b)
        const weight = (Math.abs(dis.x) + Math.abs(dis.y) + Math.abs(dis.z)) * 10
        return weight
    }

    // можно ли закрыть точку
    closeNode(node: Node, target: Vector) {
        if (this.#count++ > MAX_NODES || !node) {
            this.#found = false
            return
        }
        // перебор всех соседей
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    const is_dig = ((y == 1 || y == -1) && z == 0 && (x == 1 || x == -1)) || ((y == 1 || y == -1) && x == 0 && (z == 1 || z == -1));
                    const is_cross = (x == 0 && z == 0 && (y == 1 || y == -1)) || (y == 0 && z == 0 && (x == 1 || x == -1)) || (y == 0 && x == 0 && (z == 1 || z == -1));
                    const is_up = x == 0 && z == 0 && y == 1;
                    if ( is_cross) {
                        this.pushNode(node, x, y, z, is_up ? 16 : 10, target)
                    }
                }
            }
        }
        // добавляем в список закрытых узлов
        this.#closed.set(node.id, node)
        // удаляем из списка открытых узлов
        this.#opened.delete(node.id)
        // Если дошли до цели, то выходим
        if (this.getDistance(node.vector, target) == 0) {
            this.#found = true
            return
        }
        // находим точку с минимальным весом (ближе всего)
        let temp_node = null
        for (const val of this.#opened.values()) {
            if (!temp_node || temp_node.getF() > val.getF()) {
                temp_node = val
            }
        }
        // Закрываем точку
        this.closeNode(temp_node, target)
    }

     // Добавляем точку
     pushNode(node: Node, x: number, y: number, z: number, g: number, target: Vector) {
        const position = node.vector.offset(x, y, z);
        const key = position.toHash()
        if (this.#opened.has(key) || this.#closed.has(key) || !this.isValidePosition(position)) {
            return false
        }
        const node_temp = new Node(position, node.g + g, this.getDistance(position, target), node)
        this.#opened.set(node_temp.id, node_temp)
    }

    isValidePosition(pos: Vector) {
        const ai = this.#ai
        const mob = ai.mob
        const world = mob.getWorld()
        let block = world.getBlock(pos.offset(0, -1, 0))
        if (!this.isSolid(block)) {
            return false
        }
        block = world.getBlock(pos);
        if (!this.isTransparent(block)) {
            return false
        }
        const height = 1
        if (height > 1) {
            block = world.getBlock(pos.offset(0, 1, 0));
            if (!this.isTransparent(block)) {
                return false
            }
        }
        return true
    }

    // твердые блоки, на котрые можно вставть
    isSolid(block: any) {
        if (!block) {
            return false
        }
        // это вода/лава, на ней можно стоять если умеешь
        if (block.id == 0 && block.fluid > 0 && this.#can_swim) {
            return true
        }
        // воздух/вода/лава
        if (block.id == 0) {
            return false
        }
        return true
    }

    // через эти блоки можно проходить
    isTransparent(block) {
        if (!block) {
            return false
        }
        // это воздух/вода/лава
        if (block.id == 0 && block.fluid == 0) {
            return true
        }
        // это воздух/вода/лава
        if (block.id == 0 && block.fluid != 0 && this.#can_swim) {
            return true
        }
        // трава табличик и т.д.
        if (block.material.style == 'sign' || block.material.style == 'cover' || block.material.style == 'planting' || block.material.style == 'banner') {
            return true
        }
        return false
    }

    update(delta) {
        const ai = this.#ai
        const mob = ai.mob
        const pc = ai.pc
        if (this.#path) {
            const pos = this.#path[0].vector.offset(0.5, 0, 0.5)
            const dx = pos.x - mob.pos.x
            const dz = pos.z - mob.pos.z
            const dy = pos.y - mob.pos.y
            const dist = dx * dx + dz * dz
            if (dist < 0.1) {
                this.#timer_wall = 0
                this.#path.shift()
            }
            if (this.#timer_wall++ > MAX_TIME_DOWN || this.#path.length == 0) {
                //console.log('stop move time: ' + this.#timer_wall + ' len: ' + this.#path.length + ' dist: ' + dist + ' dy: ' + dy);
                this.#path = null
                return false
            }
            this.setLookPosition(pos)
            let jump = false
            let sneak = false
            if (pc.player_state.isInWater) {
                jump = (dy > 0.1) ? true : false
                sneak = (dy < -0.1) ? true : false
            }
            ai.updateControl({
                yaw: mob.rotate.z,
                jump: jump,
                sneak: sneak,
                forward: dist > 0 ? true : false
            }, delta)
            return true
        }
        this.setSubmerged()
        ai.updateControl({
            yaw: mob.rotate.z,
            jump: false,
            sneak: false,
            forward: false
        }, delta)
        return false
    }

    // смотрим на точку
    setLookPosition(pos: Vector, pitch: number = Math.PI) {
        const mob = this.#ai.mob
        const dx = pos.x - mob.pos.x
        const dz = pos.z - mob.pos.z
        let angle = Math.atan2(dx, dz)
        if (angle > pitch ) {
            angle = pitch
        }
        if (angle < -pitch ) {
            angle = -pitch
        }
        mob.rotate.z = angle
    }

    setSubmerged() {
        if (!this.#can_swim) {
            return
        }
        const pc = this.#ai.pc
        const mob = this.#ai.mob
        const world = mob.getWorld()

        let force = 0
        // находим глубину погружения
        for (let i = 0; i < 10; i++) {
            const water = world.getBlock(mob.pos.offset(0, i / 10, 0).floored())
            if (water?.id == 0 && (water.fluid & FLUID_TYPE_MASK) == FLUID_WATER_ID) {
                force += .15
            }
        }
        /*const force = pc.player_state.isInWater ? pc.player_state.submergedHeight : 0*/
        const velocity = new Vector(0, 0, 0)
        velocity.y = .025 * (force - 0.3)
        pc.player_state.vel.addSelf(velocity)
    }
}