import {InDeltaCompressor, OutDeltaCompressor, PacketBuffer} from "../packet_compressor.js";
import {ClientPlayerTickData, PlayerTickData} from "./player_tick_data.js";

const DEBUG_USE_HASH = true

/** A packet for command {@link ServerClient.CMD_PLAYER_CONTROL_SESSION} */
export type PlayerControlSessionPacket = {
    sessionId: int
    baseTime: number
}

export type PlayerControlPacketHeader = {
    physicsSessionId: int
    physicsTick: int   // the starting tick of this packet (the tick data starts with this tick)
}

/** 
 * It constructs a packet for command {@link ServerClient.CMD_PLAYER_CONTROL_UPDATE}
 * It consists of:
 * - {@link PlayerControlPacketHeader}
 * - one or more {@link PlayerTickData}
 * - (optional) hash
 */
export class PlayerControlPacketWriter {
    private dc = new OutDeltaCompressor(null, DEBUG_USE_HASH)

    startPutHeader(header: PlayerControlPacketHeader): void {
        this.dc.start()
            .putInt(header.physicsSessionId)
            .putInt(header.physicsTick)
    }

    putTickData(data: PlayerTickData): void {
        data.writeInput(this.dc)
        data.writeContextAndOutput(this.dc)
    }

    finish(): PacketBuffer {
        return this.dc.putHash().export()
    }
}

/** It reads what {@link PlayerControlPacketWriter} writes */
export class PlayerControlPacketReader<PlayerTickDataT extends PlayerTickData> {

    private dc = new InDeltaCompressor(null, DEBUG_USE_HASH)

    private header: PlayerControlPacketHeader = {
        physicsSessionId: 0,
        physicsTick: 0
    }

    /** This is a shared file, so to read a server class without importing it, we must supply its constructor */
    private playerTickDataClass: new () => PlayerTickDataT

    constructor(playerTickDataClass: new () => PlayerTickDataT) {
        this.playerTickDataClass = playerTickDataClass
    }

    readPacket(buf: PacketBuffer): [PlayerControlPacketHeader, PlayerTickDataT[]] {
        const dc = this.dc.start(buf)
        // read header
        const header = this.header
        header.physicsSessionId = dc.getInt()
        let physicsTick = header.physicsTick = dc.getInt()
        // read data for each tick
        const data: PlayerTickDataT[] = []
        while (dc.remaining > 1) {
            const dst = new this.playerTickDataClass()
            dst.readInput(this.dc)
            dst.readContextAndOutput(this.dc)
            dst.startingPhysicsTick = physicsTick
            physicsTick += dst.physicsTicks
            dst.physicsSessionId = header.physicsSessionId
            data.push(dst)
        }
        dc.checkHash()
        return [header, data]
    }
}

/** A packet for command {@link ServerClient.CMD_PLAYER_CONTROL_CORRECTION} */
export class PlayerControlCorrectionPacket {

    private inDc = new InDeltaCompressor(null, DEBUG_USE_HASH)
    private outDc = new OutDeltaCompressor(null, DEBUG_USE_HASH)

    physicsSessionId: int
    knownPhysicsTicks: int
    data = new PlayerTickData()

    export(): PacketBuffer {
        const dc = this.outDc.start()
        dc.putInt(this.physicsSessionId)
        dc.putInt(this.knownPhysicsTicks)
        this.data.writeContextAndOutput(dc)
        return dc.putHash().export()
    }

    read(buf: PacketBuffer) {
        const dc = this.inDc.start(buf)
        this.physicsSessionId = dc.getInt()
        this.knownPhysicsTicks = dc.getInt()
        this.data.readContextAndOutput(dc)
        dc.checkHash()
    }
}