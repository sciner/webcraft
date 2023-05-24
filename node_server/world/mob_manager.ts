import { Vector } from "@client/helpers.js";
import { Mob, MobSpawnParams } from "../mob.js";
import {DEAD_MOB_TTL, MOB_WITHOUT_CHUNK_TTL_SECONDS} from "../server_constant.js";
import type { ServerPlayer } from "../server_player.js";
import type { ServerWorld } from "../server_world.js";
import { WorldTickStat } from "./tick_stat.js";
import type {TMobConfig} from "../mob/mob_config.js";
import type {ServerChunk} from "../server_chunk.js";

// Store refs to all loaded mobs in the world
export class WorldMobManager {

    world:                          ServerWorld
    /** Невыгруженные мобы, по id */
    list:                           Map<int, Mob>
    ticks_stat:                     WorldTickStat
    ticks_stat_by_mob_type:         Map<string, WorldTickStat> = new Map()

    /**
     * Логически удаленные из игры (деактивированные или мертвые мобы) в памяти.
     * Они будут записаны в БД в ближайшей транзакции и забыты.
     * Живые мобы из этого списка могут быть ре-активированы и перемещены в {@link list}.
     * Если моб логически в игре (живой, аткивный), он не может быть в этом списке. Чанки при звгрузке не ищут мобов там.
     *
     * О реализации: для убитых мобов м могли бы хранить только id, но бывают также убитые мобы в выгруженных
     * чанках, поэому проще хранить и тут целых мобов.
     */
    inactiveById                    = new Map<int, Mob>()

    /**
     * Иммутабельная предыдущая версия {@link inactiveById}, используемая пока мобы пишутся в БД.
     * Их семантика: "уже не в {@link inactiveById}, но еще не в БД". Ре-активированные мобы должны
     * браться отсюда, а не из БД, чтобы избежать потери данных в условиях гонок.
     */
    inactiveByIdBeingWritten:       Map<int, Mob> | null = null

    configs:                        Dict<TMobConfig>

    private tmp_tick_chunk_addr     = new Vector()

    static STAT_NAMES = ['update_chunks', 'unload', 'other', 'onLive', 'onFind']
    static MOB_STAT_NAMES = ['onLive', 'onFind']

    constructor(world: ServerWorld) {

        this.world = world;
        this.list = new Map();
        this.configs = config.mobs

        this.ticks_stat = new WorldTickStat(WorldMobManager.STAT_NAMES)
    }

    /** Возвращает полное имя типа моба (с префиксом) по возможно неполному имени. Для удобства команд. */
    findTypeFullName(typeShortName: string): string | null {
        if (this.configs[typeShortName]) {
            return typeShortName
        }
        typeShortName = '/' + typeShortName
        for(let key in this.configs) {
            if (key.endsWith(typeShortName)) {
                return key
            }
        }
        return null
    }

    getTickStatForMob(mob: Mob): WorldTickStat {
        let res = this.ticks_stat_by_mob_type.get(mob.skin.model_name)
        if (res == null) {
            res = new WorldTickStat(WorldMobManager.MOB_STAT_NAMES)
            this.ticks_stat_by_mob_type.set(mob.skin.model_name, res)
            res.start()
        }
        return res
    }

    // убить всех мобов
    kill() {
        for (const mob of this.list.values()) {
            mob.kill()
        }
    }

    get(id: int): Mob | undefined {
        return this.list.get(id);
    }

    /**
     * Логически удаляет моба из мира.
     *
     * Может быть временно (деактивация) или навсегда (смерть). Это всегда вызвано важными измененим данных моба.
     * Данные моба должны быть изменены до вызова этого метода.
     *
     * Моб помещается во временный список, чтобы записать это изменение в БД в ближайшей транзакции.
     *
     * Не путать с выгрузкой: выгрузка не удаляет моба логически из мира, а лишь временно помещает его не в ОЗУ,
     * это может быть не связано с измененим данных моба.
     */
    delete(mob: Mob): void {
        mob.dirtyFlags |= Mob.DIRTY_FLAG_FULL_UPDATE
        this.inactiveById.set(mob.id, mob)
        mob.moveToChunk(null)
        mob.onUnload()
    }

    count(): int {
        return this.list.size;
    }

    tick(delta: float): void {
        const world = this.world;
        const now = performance.now()
        this.ticks_stat.start()
        for(const stat of this.ticks_stat_by_mob_type.values()) {
            stat.start()
        }
        // !Warning. All mobs must update chunks before ticks
        for(let mob of this.list.values()) {
            if(mob.isAlive) {
                const chunk_addr = world.grid.toChunkAddr(mob.pos, this.tmp_tick_chunk_addr)
                const inChunk = mob.inChunk
                if (!inChunk || !inChunk.addr.equal(chunk_addr)) {
                    const chunk_new = world.chunks.get(chunk_addr)
                    if (chunk_new !== inChunk) {
                        mob.moveToChunk(chunk_new)
                    }
                    // Если моб уже давно без чанка и сохранен в БД - забыть его
                    if (chunk_new == null) {
                        mob.noticedWithoutChunkTime ??= now
                        if (mob.noticedWithoutChunkTime < now - MOB_WITHOUT_CHUNK_TTL_SECONDS * 1000 &&
                            (mob.dirtyFlags & (~Mob.DIRTY_FLAG_SAVED_DEAD)) == 0
                        ) {
                            mob.onUnload()
                        }
                    }
                }
            }
        }
        this.ticks_stat.add('update_chunks')
        // Ticks
        for(let mob of this.list.values()) {
            if(mob.isAlive) {
                mob.tick(delta);
                this.ticks_stat.add('other')
            } else if(!mob.death_time) {
                mob.death_time = performance.now();
            } else if(performance.now() - mob.death_time > DEAD_MOB_TTL || mob?.extra_data.play_death_animation == false) {
                this.delete(mob)
                this.ticks_stat.add('unload')
            }
        }
        this.ticks_stat.end()
        for(const stat of this.ticks_stat_by_mob_type.values()) {
            stat.end()
        }
    }

    /**
     * Create mob
     */
    create(params: MobSpawnParams): Mob | null {
        const world = this.world;
        const chunk_addr = world.chunkManager.grid.toChunkAddr(params.pos)
        const chunk = world.chunks.get(chunk_addr);
        if(chunk) {
            try {
                // найти конфиг, проверить что он существует
                const type = params.skin.model_name
                const config = world.mobs.configs[type]
                if (config == null) {
                    throw `Unknown mob type ${type}`
                }
                // Добавить параметры создания
                params.id = world.db.mobs.getNextId();
                params.entity_id = randomUUID();
                if(!('pos' in params)) {
                    throw 'error_no_mob_pos';
                }
                const mob = Mob.create(world, config, params);
                mob.moveToChunk(chunk)
                mob.onAddedOrRestored()
                return mob;
            } catch(e) {
                console.error('error_create_mob', e);
            }
        } else {
            console.error('Chunk for mob not found');
        }
        return null;
    }

    /**
     * Spawn new mob
     */
    spawn(player: ServerPlayer, params: MobSpawnParams): boolean {
        try {
            return this.create(params) != null
        } catch (e) {

            // Этот код никогда не выполнятся! this.create() не кидает исключений

            console.log('e', e)
            player.sendError(e)
        }
        return false
    }

    async activate(id: int, pos_spawn?: IVector, rotate?: IVector): Promise<Mob | null> {
        let mob = this.list.get(id)
        if (mob) {
            // если моб уже активирован и в памяти
            return mob.isAlive ? mob : null
        }

        const world = this.world;
        let chunk: ServerChunk | undefined
        //
        if (pos_spawn) {
            chunk = world.chunkManager.get(world.chunkManager.grid.toChunkAddr(pos_spawn));
            if(!chunk) {
                console.error('error_chunk_not_loaded');
                return null;
            }
        }

        mob = this.inactiveById.get(id) ?? this.inactiveByIdBeingWritten?.get(id)

        let driving_data: string | null
        let loaded = false
        if (!mob) { // если нет в памяти - поробовать загрузить из БД
            [mob, driving_data] = await world.db.mobs.load(id)
            loaded = true
        }

        if(mob) {
            if (!mob.isAlive) {
                console.error('Trying to activate a dead mob');
                return null;
            }
            mob.is_active = true;
            mob.dirtyFlags |= Mob.DIRTY_FLAG_FULL_UPDATE;
            if (pos_spawn) {
                mob.pos_spawn = new Vector(pos_spawn);
                mob.moveToChunk(chunk)
            }
            if (rotate) {
                mob.rotate = new Vector(rotate);
            }
            if (loaded) {
                this.world.drivingManager.onParticipantLoaded(mob, driving_data)
            }
            mob.onAddedOrRestored()
            this.inactiveById.delete(id) // есть был неактивен в памяти - удалить из того списка
        }
        return mob
    }

    writeToWorldTransaction(underConstruction) {
        for(const mob of this.list.values()) {
            mob.writeToWorldTransaction(underConstruction, underConstruction.shutdown);
        }
        for(const mob of this.inactiveById.values()) {
            mob.writeToWorldTransaction(underConstruction, true); // force saving because these mobs will be forgotten
        }
        // make the old map of new mobs immutable, but keep it util the transaction ends
        this.inactiveByIdBeingWritten = this.inactiveById;
        this.inactiveById = new Map();
    }

    onWorldTransactionCommit() {
        this.inactiveByIdBeingWritten = null;
    }

}