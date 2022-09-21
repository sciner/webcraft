import { Vector, VectorCollector } from "../../../www/js/helpers.js";

export class DBWorldFluid {
    constructor(conn, world) {
        this.conn = conn;
        this.world = world;

        this.knownFluidChunks = new VectorCollector();
    }

    async restoreFluidChunks() {
        this.knownFluidChunks.clear();
        const rows = await this.conn.all(`SELECT DISTINCT x chunk_x, y chunk_y, z chunk_z FROM world_chunks_fluid`);
        for(let row of rows) {
            let addr = new Vector(row.chunk_x, row.chunk_y, row.chunk_z);
            this.knownFluidChunks.add(addr, 1);
        }
    }

    //
    async loadChunkFluid(chunk_addr) {
        if (!this.knownFluidChunks.has(chunk_addr)) {
            console.log(`no fluid ${chunk_addr}`)
            return null;
        }

        const row = await this.conn.get('SELECT data FROM world_chunks_fluid WHERE x = :x AND y = :y AND z = :z', {
            ':x': chunk_addr.x,
            ':y': chunk_addr.y,
            ':z': chunk_addr.z
        });
        // console.log(`loaded fluid ${chunk_addr}`)
        return row ? row['data'] : null;
    }

    //
    async saveChunkFluid(chunk_addr, data) {
        this.knownFluidChunks.add(chunk_addr, 1);
        await this.conn.run('INSERT INTO world_chunks_fluid(x, y, z, data) VALUES (:x, :y, :z, :data)', {
            ':x': chunk_addr.x,
            ':y': chunk_addr.y,
            ':z': chunk_addr.z,
            ':data': data
        });
        // console.log(`saving fluid ${chunk_addr}`)
    }
}