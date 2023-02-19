import { parseManyToMany, loadMappedImports, importClassInstanceWithId } from '../server_helpers.js'
import { BLOCK } from '../../www/src/blocks.js';
import { TBlock } from "../../www/src/typed_blocks3.js";
import { ArrayHelpers, ArrayOrMap } from '../../www/src/helpers.js';
import { ServerClient } from '../../www/src/server_client.js';
import { FLUID_TYPE_MASK, FLUID_WATER_INTERACT, FLUID_WATER_REMOVE,
    FLUID_WATER_ABOVE_INTERACT, FLUID_WATER_ABOVE_REMOVE 
} from '../../www/src/fluid/FluidConst.js';

export class TickerHelpers {

    // Pushes the result of a ticker into an array of updated blocks.
    // The result can be a single item, or an array of items, posibly containing nulls.
    static pushBlockUpdates(all_upd_blocks, new_upd_blocks) {
        if (new_upd_blocks) {
            if (Array.isArray(new_upd_blocks)) {
                // Sometimes it's covenient to add nulls, e.g. BlockUpdates.updateTNT(). Revome them here.
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

export class BlockListeners {
    calleesById: {};
    fluidBlockPropsById: Uint8Array;
    uniqueImports: {};
    promises: any[];
    calleePrefixes: {};
    beforeBlockChangeListeners: Map<any, any>;
    afterBlockChangeListeners: Map<any, any>;
    fluidChangeListeners: Map<any, any>;
    fluidRemoveListeners: Map<any, any>;
    fluidAboveChangeListeners: Map<any, any>;
    fluidAboveRemoveListeners: Map<any, any>;

    constructor() {
        this.calleesById = {}; // for DelayedCalls
        this.fluidBlockPropsById = new Uint8Array(BLOCK.max_id + 1);

        // internals
        this.uniqueImports = {};
        this.promises = [];
        this.calleePrefixes = {}; // to find duplicates
    }

    async loadAll(config) {
       
        // "Before change" listenes are called by the old (possibly to-be-removed) block id,
        // before it's changed. Use it to listen for removal, and process extra_data of the removed block.
        this.beforeBlockChangeListeners = this.#loadList(
            config.before_block_change_listeners,
            '.bbc', 0,
            (listener, calleeId) => {
                listener.onBeforeBlockChangeCalleeId = calleeId;
                // "Before change" listners are called with newMaterial == current block.material
                return function(chunk, pos) {
                    const tblock = chunk.getBlock(pos, tmp_DelayedBlockListener_block);
                    const upd_blocks = listener.onBeforeBlockChange(chunk, tblock, tblock.material, false);
                    TickerHelpers.pushBlockUpdates(chunk.blocksUpdatedByListeners, upd_blocks);
                }
            }
        );

        // "After change" listenes are called by the new block id, after it's set.
        this.afterBlockChangeListeners = this.#loadList(
            config.after_block_change_listeners,
            '.abc', 0,
            (listener, calleeId) => {
                listener.onAfterBlockChangeCalleeId = calleeId;
                return function(chunk, pos, oldBlockId) {
                    const tblock = chunk.getBlock(pos, tmp_DelayedBlockListener_block);
                    const upd_blocks = listener.onAfterBlockChange(chunk, tblock, BLOCK.BLOCK_BY_ID[oldBlockId], false);
                    TickerHelpers.pushBlockUpdates(chunk.blocksUpdatedByListeners, upd_blocks);
                }
            }
        );

        this.fluidChangeListeners = this.#loadList(
            config.fluid_change_listeners,
            '.fi', FLUID_WATER_INTERACT,
            (listener, calleeId) => {
                listener.onFluidChangeCalleeId = calleeId;
                return function(chunk, pos) {
                    const tblock = chunk.getBlock(pos, tmp_DelayedBlockListener_block);
                    const upd_blocks = listener.onFluidChange(chunk, tblock, tblock.fluid, false);
                    TickerHelpers.pushBlockUpdates(chunk.blocksUpdatedByListeners, upd_blocks);
                }
            }
        );

        this.fluidRemoveListeners = this.#loadList(
            config.fluid_remove_listeners,
            '.fr', FLUID_WATER_REMOVE,
            (listener, calleeId) => {
                listener.onFluidRemoveCalleeId = calleeId;
                return function(chunk, pos) {
                    const tblock = chunk.getBlock(pos, tmp_DelayedBlockListener_block);
                    if ((tblock.fluid & FLUID_TYPE_MASK) === 0) {
                        const upd_blocks = listener.onFluidRemove(chunk, tblock, false);
                        TickerHelpers.pushBlockUpdates(chunk.blocksUpdatedByListeners, upd_blocks);
                    }
                }
            }
        );

        this.fluidAboveChangeListeners = this.#loadList(
            config.fluid_above_change_listeners,
            '.fai', FLUID_WATER_ABOVE_INTERACT,
            (listener, calleeId) => {
                listener.onFluidAboveChangeCalleeId = calleeId;
                return function(chunk, pos) {
                    const tblock = chunk.getBlock(pos, tmp_DelayedBlockListener_block);
                    const upd_blocks = listener.onFluidAboveChange(chunk, tblock, tblock.fluid, false);
                    TickerHelpers.pushBlockUpdates(chunk.blocksUpdatedByListeners, upd_blocks);
                }
            }
        );

        this.fluidAboveRemoveListeners = this.#loadList(
            config.fluid_above_remove_listeners,
            '.far', FLUID_WATER_ABOVE_REMOVE,
            (listener, calleeId) => {
                listener.onFluidAboveRemoveCalleeId = calleeId;
                return function(chunk, pos) {
                    const tblock = chunk.getBlock(pos, tmp_DelayedBlockListener_block);
                    if ((tblock.fluid & FLUID_TYPE_MASK) === 0) {
                        const upd_blocks = listener.onFluidAboveRemove(chunk, tblock, false);
                        TickerHelpers.pushBlockUpdates(chunk.blocksUpdatedByListeners, upd_blocks);
                    }
                }
            }
        );

        return await Promise.all(this.promises);
    }

    #loadList(conf, calleeIdSuffix, fluidBlockProps, calleeFactoryFn) {
        // parse config
        const result = parseManyToMany(conf,
            name => BLOCK.fromName(name.toUpperCase()).id,
            []);
        // import code
        const p = loadMappedImports(result,
            './ticker/listeners/',
            importClassInstanceWithId,
            this.uniqueImports
        ).then((mappedImports) => {
            for(var [blockId, list] of ArrayOrMap.entries(mappedImports)) {
                // create callees
                for(var i = 0; i < list.length; i++) {
                    const listener = list[i];

                    const calleePrefix = listener.importString;
                    const exListener = this.calleePrefixes[calleePrefix];
                    if (exListener && exListener !== listener) {
                        throw new Error('Duplicate calleePrefix: ' + calleePrefix);
                    }
                    this.calleePrefixes[calleePrefix] = listener;

                    const calleeId = calleePrefix + calleeIdSuffix;
                    this.calleesById[calleeId] = calleeFactoryFn(listener, calleeId);
                }
                // add fluid flags
                if (fluidBlockProps) {
                    this.fluidBlockPropsById[blockId] |= fluidBlockProps;
                }
            }
        });
        this.promises.push(p);
        return result;
    }
};

const tmp_DelayedBlockListener_block = new TBlock();

// helper methods and constructors for frequently used block updates
export class BlockUpdates {
    
    static igniteTNT(pos, block) {
        if (block.extra_data?.explode) {
            // If it's already burning, don't overwrite the counter.
            // It may cause TNT to never explode.
            return null;
        }
        return {
            pos: pos,
            item: {id: BLOCK.TNT.id, extra_data: {explode: true, fuse: 0}},
            action_id: ServerClient.BLOCK_ACTION_MODIFY
        };
    }
}