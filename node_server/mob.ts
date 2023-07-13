import { MOB_TYPE, MOUSE, PLAYER_STATUS } from "@client/constant.js";
import {ObjectHelpers, Vector} from "@client/helpers.js";
import { ServerClient } from "@client/server_client.js";
import { MOB_SAVE_PERIOD, MOB_SAVE_DISTANCE } from "./server_constant.js";
import { DBWorldMob, MobRow } from "./db/world/mob.js"
import { AABB } from "@client/core/AABB.js";
import type { ServerWorld } from "./server_world.js";
import type { FSMBrain } from "./fsm/brain.js";
import type { EnumDamage } from "@client/enums/enum_damage.js";
import type { WorldTransactionUnderConstruction } from "./db/world/WorldDBActor.js";
import type { Indicators, PlayerSkin } from "@client/player.js";
import type { ServerPlayer } from "./server_player.js";
import { upgradeToNewIndicators } from "./db/world.js";
import type { ServerChunk } from "./server_chunk.js";
import type {ServerDriving} from "./control/server_driving.js";
import type {TMobConfig} from "./mob/mob_config.js";
import type {PrismarinePlayerControl} from "@client/prismarine-physics/using.js";
import type {TMobProps} from "@client/mob_manager.js";
import {packBooleans} from "@client/packet_compressor.js";

export class MobSpawnParams {
    // These values are added by WorldMobManager.create
    id?:            int
    entity_id?:     string

    pos:            Vector
    pos_spawn:      Vector
    rotate:         Vector
    skin:           PlayerSkin

    // These values are added to params by the mob itself
    extra_data?:    any
    indicators?:    Indicators
    is_active?:     boolean | int // 0 or 1
    driving_id?:    int

    constructor(pos: Vector, rotate: Vector, skin: PlayerSkin) {
        this.pos = new Vector(pos)
        this.pos_spawn = new Vector(pos)
        this.rotate = new Vector(rotate)
        this.skin = skin
    }

}

//
export class MobState {
    id: int;
    pos: Vector;
    rotate: Vector;
    extra_data: Dict;
    flags: int          // несколько bool значений упакованных в одно поле

    constructor(id : int, pos : Vector, rotate : Vector, extra_data : Dict, flags : int) {
        this.id = id;
        this.pos = new Vector(pos).roundSelf(3)
        this.rotate = new Vector(rotate).roundSelf(3)
        this.extra_data = ObjectHelpers.deepClone(extra_data)
        this.flags = flags
    }

    /**
     * Compare
     */
    equal(state: MobState): boolean {
        return this.pos.equal(state.pos) &&
            this.rotate.equal(state.rotate) &&
            ObjectHelpers.deepEqual(this.extra_data, state.extra_data) &&
            this.flags === state.flags
    }

}

//
export class Mob {

    /**
     * Flags in {@link dirtyFlags}. Without them, an active mob is still considered "dirty",
     * and normal updates are saved in some (but not in every) world transaction.
     */
    static DIRTY_FLAG_NEW           = 0x1; // the record is inserted. It has proority over other flags.
    static DIRTY_FLAG_FULL_UPDATE   = 0x2; // Causes aditional data to be saved, and forces the mob to not skip a transaction.
    static DIRTY_FLAG_UPDATE        = 0x4; // It indicates that something important has changed. Saving in the next transaction won't be skipped.
    static DIRTY_FLAG_SAVED_DEAD    = 0x8; // If the mob is dead and was already saved as dead, it won't be saved again.

    #world : ServerWorld;
    #brain : FSMBrain;
    #forward : Vector;
    #prev_state: MobState
    readonly config: TMobConfig
    id: int;
    entity_id: string;
    skin: PlayerSkin;
    indicators: Indicators;
    is_active?: boolean | int;
    pos: Vector;
    pos_spawn: Vector;
    rotate: Vector;
    extra_data: any;
    dirtyFlags: number;
    width: number;
    height: number;
    lastSavedTime: number;
    lastSavedPos: Vector;
    _aabb: AABB;
    already_killed?: boolean | int;
    death_time?: number;
    parent: any;
    driving?: ServerDriving | null = null

    /**
     * drivingId дублируется в отдельном поле, хотя есть в {@link driving}.
     * Если моб и/или driving выгружены, то {@link driving} == null, но {@link drivingId} остается. Это нужно чтобы:
     * - сохранить корректное drivingId в БД
     * - при востановлении моба не искать его во всех вождениях.
     *
     * Если есть несовпадения, данные в соответствующем ServerDriving имеют более высокий приоритет (боле новые).
     * Неактуальный drivingId в мобе возможно удалится, возможно не сразу - это не важно. Главное что по этому id
     * моб уже не будет включен в вождение.
     * Ситуация что в мобе нет drivingId, а в вождении моб есть, кажется маловероятной (т.к. заочно моба могут удалить из
     * вождения, но не добавить). Если такая ситуация есть - не страшно, со временем моб удалится из вождения.
     *
     * На клиент посылаем driving.id, а не это поле, т.к. важно именно реально используемое вождение.
     */
    private _drivingId: int | null

    /**
     * Чанк, в списке мобов которого находится этот моб. Может отличаться от {@link chunk_addr}.
     * Только меод {@link moveToChunk} может менять это поле, всегда одновременно с полем
     * {@link ServerChunk.mobs} соответствеющего чанка.
     * При выгрузке и восстановлении чанка, моб остается в чанке, это поле не меняется.
     */
    inChunk: ServerChunk | null = null

    /** Самое ранее время когда моб замечен без чанка. Используется чтобы забывать мобов, которые долго без чанка. */
    noticedWithoutChunkTime: number | null = null

    /**
     * Конструктор моба не должен иметь побочных эффектов. Возможно, созданный моб не будет добавлен в мир
     * (например, если он уже есть в памяти без чанка).
     */
    constructor(world : ServerWorld, config: TMobConfig, params: MobSpawnParams, existsInDB: boolean) {
        this.#world         = world;
        this.config         = config

        // Read params
        this.id             = params.id
        this.entity_id      = params.entity_id
        this.skin           = params.skin;
        this.indicators     = params.indicators;
        this.is_active      = params.is_active;
        this.pos            = new Vector(params.pos);

        // In the old DBWorldMob.create, there was
        //   ':pos_spawn':       JSON.stringify(params.pos),
        // Preserve this semantics if (params.pos_spawn == null)
        this.pos_spawn      = new Vector(params.pos_spawn ?? params.pos);

        this.rotate         = new Vector(params.rotate);
        this.extra_data     = params.extra_data || {};
        this.dirtyFlags     = existsInDB ? 0 : Mob.DIRTY_FLAG_NEW;
        // Private properties
        this.#forward       = new Vector(0, 1, 0);
        this.#brain         = world.brains.get(this.config.brain, this);
        this.width          = this.#brain.pc.playerHalfWidth * 2;
        this.height         = this.#brain.pc.playerHeight;
        this._drivingId     = params.driving_id ?? null

        // To determine when to make regular saves. Add a random to spread different mobs over different transactions.
        this.lastSavedTime  = performance.now() + Math.random() * 0.5 * MOB_SAVE_PERIOD;
        this.lastSavedPos   = new Vector(this.pos); // to force saving is the position changed to much
        this._aabb = new AABB
    }

    get type(): string  { return this.skin.model_name }

    get playerControl(): PrismarinePlayerControl { return this.#brain.pc }

    /** См. {@link _drivingId} */
    get drivingId(): int { return this._drivingId }
    set drivingId(v: int | null) {
        if (this._drivingId != v) {
            this.dirtyFlags |= Mob.DIRTY_FLAG_FULL_UPDATE
            this._drivingId = v
        }
    }

    get aabb() : AABB {
        this._aabb.set(
            this.pos.x - this.width / 2,
            this.pos.y,
            this.pos.z - this.width / 2,
            this.pos.x + this.width / 2,
            this.pos.y + this.height,
            this.pos.z + this.width / 2
        )
        return this._aabb
    }

    get forward() : Vector {
        return this.#forward.set(
            Math.sin(this.rotate.z),
            0,
            Math.cos(this.rotate.z),
        );
    }

    getWorld() : ServerWorld {
        return this.#world;
    }

    getBrain() : FSMBrain {
        return this.#brain;
    }

    /**
     * Create new mob
     */
    static create(world : ServerWorld, config: TMobConfig, params: MobSpawnParams) : Mob {
        // TODO: need to check mob type and skin from bbmodels
        // const model = world.models.list.get(params.type);
        // if(!model) {
        //     throw `Can't locate model for create: ${params.type}`;
        // }
        // if(!(params.skin in model.skins)) {
        //     throw `Can't locate skin for: ${params.type}/${params.skin}`;
        // }
        // make extra_data
        if(!params.extra_data) {
            params.extra_data = {};
        }
        params.extra_data.health = 100
        params.extra_data.play_death_animation = true
        // make indicators
        params.indicators = world.db.getDefaultPlayerIndicators();
        params.indicators.live = config.health
        params.is_active = 1; // previously is_active was selected from DB, where it's set to 1 by default
        //
        switch(params.skin.model_name) {
            case MOB_TYPE.BEE: {
                params.extra_data.pollen = 0;
                break;
            }
        }
        return new Mob(world, config, params, false);
    }

    /** @returns параметры для создания моба на клиенте */
    exportMobModelConstructorProps(): TMobProps {
        const config = this.config
        return {
            id          : this.id,
            type        : this.type,
            indicators  : this.indicators,
            width       : this.width,
            height      : this.height,
            pos         : this.pos,
            rotate      : this.rotate,
            skin        : this.skin,
            extra_data  : this.extra_data,
            hasUse      : config.hasUse,
            supportsDriving : config.driving != null,
            animations  : config.animations ?? null
        }
    }

    tick(delta: float): void {
        if (this.extra_data.health == 0) {
            return
        }
        this.#brain.tick(delta)
    }

    addVelocity(vec: Vector) {
        this.#brain.pc.player_state.vel.addSelf(vec);
        this.#brain.pc.tick(0);
    }

    // Marks that the mob needs to save a normal update in the next word transaction (i.e. not skip that transaction).
    markDirty() {
        this.dirtyFlags |= Mob.DIRTY_FLAG_UPDATE;
    }

    /**
     * Вызывает действия, связанные с выгрузкой из памяти моба.
     *
     * Выгрузка может быть как вместе с выгружаемым чанком, так и только это моба. Во стором случае
     * вызывающий должен не забыть удалить моба из чанка.
     *
     * Выгрузка может быть в список выгруженых мобов, или моб может быть забыт полностью. Об этом должен
     * заботиться вызывающий.
     *
     * @return true если есть что сохранять в мировой транзакци для этого моба
     */
    onUnload(): boolean {
        //console.debug(`Mob unloaded ${this.entity_id}, ${this.id}`);
        this.#world.mobs.list.delete(this.id)
        this.driving?.onMobUnloadedOrRemoved(this)
        // we assume there is always some change to save, unless it's been already saved as dead
        return (this.dirtyFlags & Mob.DIRTY_FLAG_SAVED_DEAD) == 0
    }

    /**
     * Выполняет все действия, связанные с добавлением, загрузкой или востановлением моба,
     * кроме помещения в чанк.
     * Почему кроме помещения в чанк: в разных ситуациях, моб может уже быть или не быть в чанке;
     * чанк может быть известен или нет. Поэтому вызывающий должен позаботиться о чанке, см. {@link moveToChunk}.
     */
    onAddedOrRestored(): void {
        const world = this.#world
        world.mobs.list.set(this.id, this)
        world.drivingManager.onMobAddedOrRestored(this)
        this.noticedWithoutChunkTime = null // если был долго выгружен без чанка - не должен сразу удаляться
    }

    /**
     * Перемещает моба из его текущего чана {@link inChunk} в чанк {@link chunk}.
     * @param sendUpdate - если true, то посылает команды игрокам:
     *  {@link ServerClient.CMD_MOB_ADD} - всем игрокам соединенным с новым чанком
     *  {@link ServerClient.CMD_MOB_DELETE} - игрокам соединенным со старым, но не с новым чанком
     */
    moveToChunk(chunk: ServerChunk | null, sendUpdate: boolean = true): void {
        const oldChunk = this.inChunk
        if (chunk === oldChunk) {
            return
        }
        if (oldChunk) {
            oldChunk.mobs.delete(this.id)
            if (sendUpdate) {
                const exceptPlayerIds = chunk ? Array.from(chunk.connections.keys()) : null
                const msg = {
                    name: ServerClient.CMD_MOB_DELETE,
                    data: [this.id]
                }
                oldChunk.world.sendSelected([msg], oldChunk.connections.keys(), exceptPlayerIds)
            }
        }
        if (chunk) {
            chunk.mobs.set(this.id, this)
            if (sendUpdate) {
                chunk.sendAll([{
                    name: ServerClient.CMD_MOB_ADD,
                    data: [this.exportMobModelConstructorProps()]
                }])
            }
            this.noticedWithoutChunkTime = null
        }
        this.inChunk = chunk
    }

    setDamage(val : number, type_damage? : EnumDamage, actor?) {
        this.#brain.onDamage(val, type_damage, actor);
    }

    setUseItem(item_id, actor) {
        return this.#brain.onUse(actor, item_id);
    }

    // Kill
    kill(): void {
        if(this.already_killed) {
            return;
        }
        this.already_killed = true
        this.indicators.live = 0
        this.extra_data.health = 0
        this.driving?.removeMobId(this.id)
        this.#brain.sendState();
    }

    // Deactivate
    deactivate() {
        this.is_active = false;
        this.dirtyFlags |= Mob.DIRTY_FLAG_FULL_UPDATE;
        this.#world.mobs.inactiveById.set(this.id, this);
        this.moveToChunk(null);
        this.onUnload();
    }

    get isAlive() : boolean {
        return this.extra_data.health > 0
    }

    // если игрока нет, он умер или сменил игровой режим на безопасный, то его нельзя атаковать
    playerCanBeAtacked(player?: ServerPlayer) {
        return !player || player.status !== PLAYER_STATUS.ALIVE || !player.game_mode.getCurrent().can_take_damage;
    }

    /** Создает моба на основе данных из БД, если возможно (например, тип моба могли удалить в коде). */
    static fromRow(world: ServerWorld, row: MobRow): Mob | null {
        const config = world.mobs.configs[row.type]
        if (config == null) {
            console.log(`Unknown mob type ${row.type}`)
            return null
        }
        return new Mob(world, config, {
            id:         row.id,
            rotate:     JSON.parse(row.rotate),
            pos_spawn:  JSON.parse(row.pos_spawn),
            pos:        new Vector(row.x, row.y, row.z),
            entity_id:  row.entity_id,
            skin:       {model_name: row.type, texture_name: row.skin} as PlayerSkin,
            is_active:  row.is_active != 0,
            extra_data: JSON.parse(row.extra_data),
            indicators: upgradeToNewIndicators(JSON.parse(row.indicators)),
            driving_id: row.driving_id
        }, true);
    }

    /** Обновляет параемтры моба на основе состояния {@link PrismarinePlayerControl} */
    updateStateFromControl(): void {
        const pc = this.#brain.pc
        this.pos.copyFrom(pc.getPos())
        this.rotate.z = pc.player_state.yaw
    }

    exportState(return_diff = false): MobState | null {
        const player_sate = this.playerControl.player_state
        const flags = packBooleans(player_sate.onGround, player_sate.isInLiquid)
        const new_state = new MobState(this.id, this.pos, this.rotate, this.extra_data, flags)
        if(return_diff && this.#prev_state) {
            if(new_state.equal(this.#prev_state)) {
                return null
            }
            if(ObjectHelpers.deepEqual(new_state.extra_data, this.#prev_state.extra_data)) {
                new_state.extra_data = null
            }
        }
        return this.#prev_state = new_state
    }

    writeToWorldTransaction(underConstruction: WorldTransactionUnderConstruction, force = false): void {
        const dirtyFlags = this.dirtyFlags;
        if (dirtyFlags & Mob.DIRTY_FLAG_SAVED_DEAD) {
            return;
        }

        if (!this.isAlive) {  // dying is important, don't skip this transaction
            underConstruction.deleteMobIds.push(this.id);
            // prevent it from ever being written again (if it's still in memory by the time of the next transacton)
            this.dirtyFlags = Mob.DIRTY_FLAG_SAVED_DEAD;
            return;
        }
        this.dirtyFlags = 0;

        // if the update is unimportant, skip some transactions
        if (dirtyFlags === 0 && !force &&
            performance.now() - this.lastSavedTime < MOB_SAVE_PERIOD &&
            this.pos.distanceSqr(this.lastSavedPos) < MOB_SAVE_DISTANCE * MOB_SAVE_DISTANCE
        ) {
            return;
        }
        this.lastSavedTime  = performance.now() + Math.random() * 0.5 * MOB_SAVE_PERIOD;
        this.lastSavedPos.copyFrom(this.pos);

        // common fields for all updates
        const updateRow = DBWorldMob.toUpdateRow(this);
        if (!(dirtyFlags & (Mob.DIRTY_FLAG_NEW | Mob.DIRTY_FLAG_FULL_UPDATE))) {
            underConstruction.updateMobRows.push(updateRow);
            return;
        }

        // common fields for full update and insert
        const fullUpdateRow = DBWorldMob.upgradeRowToFullUpdate(updateRow, this);
        if (!(dirtyFlags & Mob.DIRTY_FLAG_NEW)) {
            underConstruction.fullUpdateMobRows.push(fullUpdateRow);
            return;
        }

        // insert
        const insertRow = DBWorldMob.upgradeRowToInsert(fullUpdateRow, this);
        underConstruction.insertMobRows.push(insertRow);
    }

}