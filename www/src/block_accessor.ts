import {Vector} from "./helpers/vector.js";
import {TBlock} from "./typed_blocks3.js";
import type {ChunkManager} from "./chunk_manager.js";
import type {World} from "./world.js";
import type {ChunkGridMath} from "./core/ChunkGridMath.js";

const tmp_BlockAccessor_Vector = new Vector();

/**
 * Класс, возвращающий блоки по мировым координатам.
 * Полезен при доступе к нескольким близко расположеным блокам - быстрее, чем {@link World.getBlock}.
 * Ускорение достигается за счет кешировния текущего чанка и индексоов.
 *
 * Как пользоваться:
 * 1. Перед каждым использованием 1 раз вызвать {@link reset}
 * 2. Менять координаты текущего блока разными методами: {@link x}, {@link y}, {@link z}, {@link set}, {@link addScalar}, и т.п.
 * 3. Обращаться к текущему блоку через поле {@link block} (он может принимать значение DUMMY!)
 */
export class BlockAccessor {
    world                   : World
    chunkManager            : ChunkManager
    gridMath                : ChunkGridMath
    
    private chunkCoord      : Vector        // указывает на Chunk.coord, либо на _tmpChunkCoord
    private _tmpChunkCoord  = new Vector()  // используется вместо Chunk.coord если текущий чанк не готов
    
    private tblockVec       = new Vector()  // координата текущего блока относительно чанка
    private tblock          = new TBlock(null, this.tblockVec) // Текущий блок

    // константы из грида, для быстрого доступа
    private sizeXMinus1     : int
    private sizeYMinus1     : int
    private sizeZMinus1     : int
    
    /** 
     * Блок в текущей позиции - TBlock или DUMMY.
     * Значение ействительно до следущего изменения позиции или {@link reset}
     */
    block   : TBlock

    constructor(world: IWorld) {
        this.world          = world as World
        this.chunkManager   = this.world.chunkManager
    }

    /**
     * Обязательно нужно вызывать перед каждым новым использованием.
     * Под использованием имеется в виду одно моделирование физики, одна команда пользователя, один вызов тикера,
     * и т.п. - любой синхронный участок кода в котром чанки в мире не менются.
     * @param initial - любой блок или координаты блока, но желательно недалеко от рассматриваемой области
     */
    reset(initial: IVector | TBlock): this {
        // ленивая инициализцая не в конструкторе из-за того, что на клиенте grid еще не досутпен в момент создания игрока
        if (!this.gridMath) {
            const grid          = this.world.grid
            this.gridMath       = grid.math
            this.sizeXMinus1    = grid.chunkSize.x - 1
            this.sizeYMinus1    = grid.chunkSize.y - 1
            this.sizeZMinus1    = grid.chunkSize.z - 1
        }
        // переход к указанному блоку
        if ((initial as TBlock).tb) {
            const tblock =  initial as TBlock
            this.tblockVec.copyFrom(tblock.vec)
            this.tblock.tb = tblock.tb
            this.chunkCoord = tblock.tb.coord
            this.block = this.tblock
        } else {
            const vec = initial as IVector
            this._changeChunk(vec.x, vec.y, vec.z)
        }
        return this
    }

    getPos(pos: Vector): Vector {
        return pos.copyFrom(this.tblockVec).addSelf(this.chunkCoord)
    }

    /** @returns клонированная мировая позиция текущего блока */
    clonePos(): Vector {
        return this.tblockVec.clone().addSelf(this.chunkCoord)
    }

    /** @returns мировая координата X текущего блока */
    get x(): int {
        return this.chunkCoord.x + this.tblockVec.x;
    }

    get y(): int {
        return this.chunkCoord.y + this.tblockVec.y;
    }

    get z(): int {
        return this.chunkCoord.z + this.tblockVec.z;
    }

    /** Устанавливает мировую координату X текущего бока */
    set x(x: int) {
        const rx = x - this.chunkCoord.x;
        if ((rx | this.sizeXMinus1 - rx) >= 0) { // if (rx >= 0 && rx <= CHUNK_SIZE_X_M1)
            this.tblock.index += this.gridMath.cx * (rx - this.tblockVec.x)
            this.tblockVec.x = rx;
            return;
        }
        this._changeChunk(x, this.y, this.z);
    }

    set y(y: int) {
        const ry = y - this.chunkCoord.y;
        if ((ry | this.sizeYMinus1 - ry) >= 0) { // if (ry >= 0 && ry <= CHUNK_SIZE_Y_M1)
            this.tblock.index += this.gridMath.cy * (ry - this.tblockVec.y)
            this.tblockVec.y = ry;
            return;
        }
        this._changeChunk(this.x, y, this.z);
    }

    set z(z: int) {
        const rz = z - this.chunkCoord.z;
        if ((rz | this.sizeZMinus1 - rz) >= 0) { // if (rz >= 0 && rz <= CHUNK_SIZE_Z_M1)
            this.tblock.index += this.gridMath.cz * (rz - this.tblockVec.z)
            this.tblockVec.z = rz;
            return;
        }
        this._changeChunk(this.x, this.y, z);
    }

    /**
     * Усанавливает координаты текущего блока.
     * Этот метод быстрее, чем устанавливать x, y и z по отдельности.
     */
    setScalar(x: int, y: int, z: int): this {
        const chunkCoord = this.chunkCoord
        const rx = x - chunkCoord.x
        const ry = y - chunkCoord.y
        const rz = z - chunkCoord.z
        if ((rx | ry | rz | this.sizeXMinus1 - rx | this.sizeYMinus1 - ry | this.sizeZMinus1 - rz) >= 0) {
            this._setRelativePos(rx, ry, rz)
            return this
        }
        this._changeChunk(x, y, z)
        return this
    }

    set(vec: Vector): this {
        return this.setScalar(vec.x, vec.y, vec.z)
    }

    /** Устанавливает координаты текущего блока равные сумме вектора и смещения */
    setOffset(vec: Vector, dx: int, dy: int, dz: int): this {
        return this.setScalar(vec.x + dx, vec.y + dy, vec.z + dz)
    }

    /**
     * Добавляет к X, Y и Z текущего блока.
     * Это быстрее, чем добавлять ко всем трем по отдельности, но медленней, чем добавить к одному.
     */
    addScalar(dx: int, dy: int, dz: int): this {
        const tblockVec = this.tblockVec
        const rx = tblockVec.x + dx
        const ry = tblockVec.y + dy
        const rz = tblockVec.z + dz
        if ((rx | ry | rz | this.sizeXMinus1 - rx | this.sizeYMinus1 - ry | this.sizeZMinus1 - rz) >= 0) {
            this._setRelativePos(rx, ry, rz)
            return this
        }
        const chunkCoord = this.chunkCoord
        this._changeChunk(chunkCoord.x + rx, chunkCoord.y + ry, chunkCoord.z + rz)
        return this
    }

    /** Устанавливает относительную позицию в чанке */
    private _setRelativePos(rx: int, ry: int, rz: int): void {
        this.tblockVec.setScalar(rx, ry, rz)
        this.tblock.index = this.gridMath.relativePosToChunkIndex_s(rx, ry, rz)
    }

    private _changeChunk(x: int, y: int, z: int): void {
        const grid = this.chunkManager.grid
        const addr = grid.getChunkAddr(x, y, z, tmp_BlockAccessor_Vector);
        // Получить данные чанка. Эта строка учитывает и отсутствующие, и не готорые чанки
        const tb = this.chunkManager.getChunk(addr)?.tblocks

        if (tb) {
            this.chunkCoord = tb.coord
            this.block      = this.tblock
            this.tblock.tb  = tb
        } else {
            grid.chunkAddrToCoord(addr, this._tmpChunkCoord)
            this.chunkCoord = this._tmpChunkCoord
            this.block      = this.chunkManager.DUMMY
            this.tblock.tb  = null // не обязательно, но может помочь обнаружить баг
        }
        this._setRelativePos(x - this.chunkCoord.x, y - this.chunkCoord.y, z - this.chunkCoord.z);
    }
}