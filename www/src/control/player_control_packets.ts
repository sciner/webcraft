import {InDeltaCompressor, OutDeltaCompressor, PacketBuffer} from "../packet_compressor.js";
import {PlayerTickData} from "./player_tick_data.js";

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
export class PlayerControlPacketReader {

    private static dummyData = new PlayerTickData()

    private dc = new InDeltaCompressor(null, DEBUG_USE_HASH)

    private header: PlayerControlPacketHeader = {
        physicsSessionId: 0,
        physicsTick: 0
    }

    startGetHeader(data: PacketBuffer): PlayerControlPacketHeader {
        const dc = this.dc.start(data)
        const header = this.header
        header.physicsSessionId = dc.getInt()
        header.physicsTick = dc.getInt()
        return header
    }

    /**
     * Reads one more {@link PlayerTickData}, if there are still records in the packet.
     * @param dst - the data that will be read
     * @returns true if the data has been read
     */
    readTickData(dst: PlayerTickData): boolean {
        if (this.dc.remaining <= 1) {
            return false
        }
        dst.readInput(this.dc)
        dst.readContextAndOutput(this.dc)
        return true
    }

    finish(): void {
        while(this.readTickData(PlayerControlPacketReader.dummyData)) {
            // skip the remaining ticks data, if any
        }
        this.dc.checkHash()
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