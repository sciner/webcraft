import type { ServerWorld } from '../../server_world.js';
import { preprocessSQL, run } from "../db_helpers.js";

/**
 * Данные для создания или обновления записи вождения.
 * data - даные преобразованные в строку. Текущий формат: [TDrivingState, PrismarinePlayerState.exportPOJO()]
 */
export type DrivingUpdateRow = [id: int, data: string]

let BULK_UPDATE: string | undefined
let BULK_INSERT: string | undefined

export class DBWorldDriving {
    readonly conn       : DBConnection
    readonly world      : ServerWorld
    private maxId       : int

    constructor(conn: DBConnection, world: ServerWorld) {
        this.conn = conn
        this.world = world
    }

    async init() {
        this.maxId = (await this.conn.get('SELECT id FROM driving ORDER BY id DESC LIMIT 1'))?.id ?? 0
    }

    getNextId(): int {
        return ++this.maxId
    }

    bulkUpdate(rows: DrivingUpdateRow[]): Promise<any> | 0 {
        BULK_UPDATE ??= preprocessSQL(`
            UPDATE driving
            SET data = %1
            FROM json_each(:jsonRows)
            WHERE driving.id = %0
        `)
        return rows.length && run(this.conn, BULK_UPDATE, {
            ':jsonRows': JSON.stringify(rows)
        })
    }

    bulkInsert(rows: DrivingUpdateRow[]): Promise<any> | 0 {
        BULK_INSERT ??= preprocessSQL(`
            INSERT INTO driving (id, data)
            SELECT %0, %1 FROM json_each(:jsonRows)
        `)
        return rows.length && run(this.conn, BULK_INSERT, {
            ':jsonRows': JSON.stringify(rows)
        })
    }

    bulkDelete(ids: int[]): Promise<any> | 0 {
        return ids.length && run(this.conn,
            'DELETE FROM driving WHERE id IN (SELECT value FROM json_each(?))',
            [JSON.stringify(ids)]
        )
    }

}