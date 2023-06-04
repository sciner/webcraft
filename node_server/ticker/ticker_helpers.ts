import {importInstance} from '../server_helpers.js'
import { BLOCK } from '@client/blocks.js';
import { TBlock } from "@client/typed_blocks3.js";
import { ArrayHelpers, Vector } from '@client/helpers.js';
import { BLOCK_ACTION } from '@client/server_client.js';
import {FLUID_WATER_INTERACT, FLUID_WATER_REMOVE, FLUID_WATER_ABOVE_INTERACT, FLUID_WATER_ABOVE_REMOVE} from '@client/fluid/FluidConst.js';
import type { ServerChunk } from '../server_chunk.js';
import type {TActionBlock} from "@client/world_action.js";
import type {ServerWorld} from "../server_world.js";

export class TickerHelpers {

    /** Pushes the result of {@link TTickerFunction} into an array of updated blocks */
    static pushBlockUpdates(all_upd_blocks: TActionBlock[], new_upd_blocks: (TActionBlock | null)[] | TActionBlock | null): void {
        if (new_upd_blocks) {
            if (Array.isArray(new_upd_blocks)) {
                // Sometimes it's convenient to add nulls, e.g. BlockUpdates.updateTNT(). Remove them here.
                ArrayHelpers.filterSelf(new_upd_blocks, v => v != null);
                if (new_upd_blocks.length > 0) {
                    all_upd_blocks.push(...new_upd_blocks);
                }
            } else { // a single change was returned
                all_upd_blocks.push(new_upd_blocks);
            }
        }
    }
}

export type TBlockListenerResult = {
    /** Если задаано, то вызывать через указанное время */
    callAgainDelay?: int
    /** Если задаано, то этот параметр будет передан в следующий вызов */
    callAgainParam?: any
    /** Если задано, то будет создано действие с этии блоками */
    blocks?: (TActionBlock | null)[] | TActionBlock
}

export interface IBlockListener {
    /** Необязательное более короткое id, не зависящее от имени файла. Задержанные вызовы функций сохраняются в БД с его использованием. */
    id?: string

    /** Эти поля заполняются автоматически, ими может пользоваться реализация */
    world?: ServerWorld
    block_manager?: typeof BLOCK

    /** В каких ситуациях вызывать {@link onChange} */
    onChangeEnabled?: {
        set?: boolean           // после установки этого блока
        delete?: boolean        // после удаления этого блоа
        loadBelow?: boolean     // после загрузки чанка под блоком
        fluidChange?: boolean
        fluidRemove?: boolean
    }

    /** В каких ситуациях вызывать {@link onNeighbour} */
    onNeighbourEnabled?: {
        above?: boolean
        loadAbove?: boolean         // после загрузки чанка над блоком
        fluidChangeAbove?: boolean
        fluidRemoveAbove?: boolean
    }

    /**
     * Слушатель изменения этого блока.
     * Может вызываться до изменения, после изменения, или когда нет изменения (например, при загрузке
     * соседнего чанка).
     */
    onChange?(chunk: ServerChunk, pos: Vector, block: TBlock, oldId: int, param?: any): TBlockListenerResult | null

    /**
     * Слушатель изменения соседа (пока реализовано только для жидкостей).
     * Вызывается после изменения соседа, или при отстутсвии изменения (например, при загрузке соседнего чанка).
     * @param dir - вектор, указывающий направление на соседа, например, (0, 1, 0)
     */
    onNeighbour?(chunk: ServerChunk, pos: Vector, block: TBlock, neighbour: TBlock, dir: IVector, param?: any): TBlockListenerResult | null

    // эти поля заполняются автоматически - не обяъвлять их в реализации класса
    _onChangeCalleeId?: string
    _onNeighbourChangeCalleeId?: string
    _thisArray?: IBlockListener[]
}

/** Для каждого id блока может быть массив слушателей */
type ListenersTable = (IBlockListener[] | undefined)[]

/**
 * Загружает и хранит обраотчики изменения блоков, которые умеют:
 * - вызываться при изменении блока, жидкости, соседних блоков или загрузке соседнего чанка
 * - повторно выполняться с задержкой
 */
export class BlockListeners {
    readonly world: ServerWorld
    readonly block_manager: typeof BLOCK
    calleesById: Dict<Function> = {} // для DelayedCalls
    fluidBlockPropsById: Uint8Array;

    /** Списки слушателей у которых вызывается {@link IBlockListener.onChange} */
    onChange_set            : ListenersTable = []
    onChange_delete         : ListenersTable = []
    onChange_loadBelow      : ListenersTable = []
    onChange_fluidChange    : ListenersTable = []
    onChange_fluidRemove    : ListenersTable = []

    /** Списки слушателей у которых вызывается {@link IBlockListener.onNeighbour} */
    onNeighbour_above               : ListenersTable = []
    onNeighbour_loadAbove           : ListenersTable = []
    onNeighbour_fluidChangeAbove    : ListenersTable = []
    onNeighbour_fluidRemoveAbove    : ListenersTable = []

    blocksUpdatedByDelayedCalls : TActionBlock[] = []
    private tmpBlock            = new TBlock()
    private tmpNeighbourBlock   = new TBlock()

    constructor(world: ServerWorld) {
        this.world = world
        this.block_manager = world.block_manager
        this.fluidBlockPropsById = new Uint8Array(this.block_manager.max_id + 1)
    }

    async loadAll() {

        function add(block: IBlockMaterial, listener: IBlockListener, list: ListenersTable): void {
            (list[block.id] ??= []).push(listener)
        }

        const uniqueListeners = new Map<string, IBlockListener>()
        const tmpPos = new Vector()
        
        // найти все используемые слушатели
        for(const block of this.block_manager.getAll()) {
            const importStrings = block.listeners ?? ArrayHelpers.EMPTY
            for(const importStr of importStrings) {
                uniqueListeners.set(importStr, null)
            }
        }

        // загрузить все классы
        for(const importStr of uniqueListeners.keys()) {
            const listener = await importInstance<IBlockListener>('./ticker/listeners/', importStr)
            uniqueListeners.set(importStr, listener)

            // препроцессинг
            const id = listener.id ?? importStr
            listener._thisArray = [listener]
            listener.world = this.world
            listener.block_manager = this.block_manager

            // создать и зарегистрировать функции с задержанным вызовом
            listener._onChangeCalleeId          = id + '.oc'
            this.calleesById[listener._onChangeCalleeId] = (chunk: ServerChunk, pos: IVector, param: any) => {
                const tblock = chunk.getBlock(pos, null, null, this.tmpBlock)
                const material = tblock.material
                chunk.callBlockListeners(listener._thisArray, tmpPos.copyFrom(pos), tblock, tblock.id, this.blocksUpdatedByDelayedCalls, param)
            }

            listener._onNeighbourChangeCalleeId = id + '.onc'
            this.calleesById[listener._onNeighbourChangeCalleeId] = (chunk: ServerChunk, pos: IVector, dir: IVector, param: any) => {
                const tblock    = chunk.getBlock(pos, null, null, this.tmpBlock)
                const neighbour = chunk.getBlock(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z, this.tmpNeighbourBlock, true)
                chunk.callNeighbourListeners(listener._thisArray, tmpPos.copyFrom(pos), tblock, neighbour, dir, this.blocksUpdatedByDelayedCalls, param)
            }
        }
        
        // зарегистрировать слушателей для блоков
        for(const block of this.block_manager.getAll()) {
            const importStrings = block.listeners ?? ArrayHelpers.EMPTY
            for(const importStr of importStrings) {
                const listener = uniqueListeners.get(importStr)
                const {onChangeEnabled, onNeighbourEnabled} = listener

                // для вызова onChange
                if (onChangeEnabled.set)        add(block, listener, this.onChange_set)
                if (onChangeEnabled.delete)     add(block, listener, this.onChange_delete)
                if (onChangeEnabled.loadBelow)  add(block, listener, this.onChange_loadBelow)
                if (onChangeEnabled.fluidChange) {
                    add(block, listener, this.onChange_fluidChange)
                    this.fluidBlockPropsById[block.id] |= FLUID_WATER_INTERACT
                }
                if (onChangeEnabled.fluidRemove) {
                    add(block, listener, this.onChange_fluidRemove)
                    this.fluidBlockPropsById[block.id] |= FLUID_WATER_REMOVE
                }

                // для вызова onNeighbour
                if (onNeighbourEnabled.above)       add(block, listener, this.onNeighbour_above)
                if (onNeighbourEnabled.loadAbove)   add(block, listener, this.onNeighbour_loadAbove)
                if (onNeighbourEnabled.fluidChangeAbove) {
                    add(block, listener, this.onNeighbour_fluidChangeAbove)
                    this.fluidBlockPropsById[block.id] |= FLUID_WATER_ABOVE_INTERACT
                }
                if (onNeighbourEnabled.fluidRemoveAbove) {
                    add(block, listener, this.onNeighbour_fluidRemoveAbove)
                    this.fluidBlockPropsById[block.id] |= FLUID_WATER_ABOVE_REMOVE
                }
            }
        }
    }

}

// helper methods and constructors for frequently used block updates
export class BlockUpdates {
    
    static igniteTNT(pos : Vector, block) {
        if (block.extra_data?.explode) {
            // If it's already burning, don't overwrite the counter.
            // It may cause TNT to never explode.
            return null;
        }
        return {
            pos: pos.clone(),
            item: {id: BLOCK.TNT.id, extra_data: {explode: true, fuse: 0}},
            action_id: BLOCK_ACTION.MODIFY
        };
    }
}