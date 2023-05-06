import type {ServerPlayer} from "../server_player.js";
import type {ServerWorld} from "../server_world.js";
import {PLAYER_STATUS} from "@client/constant.js";

/** Тип команды-апдейта, посылаемого на клиент */
export enum ObjectUpdateType { ADD = 0, UPDATE, DELETE }

/**
 * Объект, знание о котром игроками может быть отслежено с помощью {@link AwarePlayers}
 *
 * A possible optimization: cache updates (not needed for driving)
 */
export interface IAwarenessObject {
    get world(): ServerWorld
    get pos(): IVector

    /** @return команда, создающая, обновляющая или уничтожающая объект на клиенте. */
    exportUpdateMessage(updateType: ObjectUpdateType): INetworkMessage
}

/**
 * Отслеживает какие игроки знают об этом объекте.
 * Высылает разным игрокам апдейты соответствующего типа.
 */
export class AwarePlayers {

    private obj: IAwarenessObject
    private lastTickSent = -1

    /**
     * Какие игроки получали сообщение об этом объекте и когда последний раз.
     * Ключи - playerId. В значения - текущий экземпляр игрока. Если будут новый экземпляр - он получит новый апдейт.
     */
    private entries = new Map<int, [player: ServerPlayer, lastTickSeen: int]>()
    private useQueue: boolean

    constructor(obj: IAwarenessObject, useQueue = false) {
        this.obj = obj
        this.useQueue = useQueue
    }

    /**
     * Высылет апдейт так же как {@link sendUpdateToUserIds} игрокам, перечисленным в chunk.connections.
     *
     * Sends update like {@link sendUpdateToUserIds} to the players connected to the chunk containing the object.
     */
    sendUpdate(updated: boolean = true): void {
        const chunk = this.obj.world.chunkManager.getByPos(this.obj.pos)
        const map = chunk ? chunk.connections : this.entries
        this.sendUpdateToUserIds(map.keys(), updated)
    }

    /**
     * Высылает {@link ObjectUpdateType.ADD} игрокам, встречающим объект впервые.
     * Если {@link updated} == true, высылает {@link ObjectUpdateType.UPDATE} игрокам, уже получавшим апдейты.
     * Высылает {@link ObjectUpdateType.DELETE} игрокам, получавшиапдейт ранее, но не включенным в {@link userIds}.
     *   Также забывает этих игроков (так что если они опять появятся, они получат {@link ObjectUpdateType.ADD}).
     *
     * Для получения самих пакетов, вызывает {@link IAwarenessObject.exportUpdateMessage}
     *
     * @param userIds - исписок id игроков, которые должны знать об объекте в данный момент
     * @param updated - true, если объект изменился и нужно высылать {@link ObjectUpdateType.UPDATE}
     */
    sendUpdateToUserIds(userIds: Iterable<int>, updated: boolean = true): void {
        const world = this.obj.world
        const tickNumber = world.ticks_stat.number
        if (!updated && this.lastTickSent === tickNumber) {
            return
        }
        this.lastTickSent = tickNumber

        let updatePacket: INetworkMessage | null = null
        let createPacket: INetworkMessage | null = null

        for(const userId of userIds) {
            let entry = this.entries.get(userId)
            if (entry && entry[0].status === PLAYER_STATUS.DELETED) {
                this.entries.delete(userId)
                entry = null
            }
            if (entry == null) {
                const player = world.players.get(userId)
                if (player) {
                    entry = [player, tickNumber]
                    this.entries.set(userId, entry)
                    createPacket ??= this.obj.exportUpdateMessage(ObjectUpdateType.ADD)
                    this.sendPacket(player, createPacket)
                }
            } else if (entry[1] !== tickNumber || updated) {
                entry[1] = tickNumber
                if (updated) {
                    updatePacket ??= this.obj.exportUpdateMessage(ObjectUpdateType.UPDATE)
                    this.sendPacket(entry[0], updatePacket)
                }
            }
        }
        this._sendDelete(tickNumber)
    }

    /**
     * Высылает {@link ObjectUpdateType.DELETE} всем игрокам, видившим объект ранее.
     *
     * It sends {@link ObjectUpdateType.DELETE} to all players who have seen it previously.
     */
    sendDelete(): void {
        this._sendDelete(-1)
    }

    private _sendDelete(ignoreTickNumber: int): void {
        let deletePacket: INetworkMessage | null = null

        for(const entry of this.entries.values()) {
            if (entry[1] === ignoreTickNumber) {
                continue
            }
            const player = entry[0]
            if (player.status !== PLAYER_STATUS.DELETED) {
                deletePacket ??= this.obj.exportUpdateMessage(ObjectUpdateType.DELETE)
                this.sendPacket(player, deletePacket)
            }
            this.entries.delete(player.userId)
        }
    }

    private sendPacket(player: ServerPlayer, packet: INetworkMessage): void {
        if (this.useQueue) {
            player.world.packets_queue.add([player.userId], [packet])
        } else {
            player.sendPackets([packet])
        }
    }
}