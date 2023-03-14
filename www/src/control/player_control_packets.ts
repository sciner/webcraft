import {InDeltaCompressor, OutDeltaCompressor, PacketBuffer} from "../packet_compressor.js";
import {PlayerTickData} from "./player_tick_data.js";

const DEBUG_USE_HASH = true

/** A packet for command {@link ServerClient.CMD_PLAYER_CONTROL_SESSION} */
export type PlayerControlSessionPacket = {
    sessionId: int
    baseTime: number
}

/** 
 * It constructs a packet for command {@link ServerClient.CMD_PLAYER_CONTROL_UPDATE}
 * It consists of:
 * - physicsSessionId
 * - one or more {@link PlayerTickData}
 * - (optional) hash
 */
export class PlayerControlPacketWriter {
    private dc = new OutDeltaCompressor(null, DEBUG_USE_HASH)

    startPutSessionId(physicsSessionId: int): void {
        this.dc.start().putInt(physicsSessionId)
    }

    putTickData(data: PlayerTickData): void {
        data.writeInput(this.dc)
        data.writeContextAndOutput(this.dc)
    }

    finish(): PacketBuffer | null {
        return this.dc.putHash().export()
    }
}

/** It reads what {@link PlayerControlPacketWriter} writes */
export class PlayerControlPacketReader {
    private dc = new InDeltaCompressor(null, DEBUG_USE_HASH)
    private static dummyData = new PlayerTickData()

    startGetSessionId(data: PacketBuffer): int {
        return this.dc.start(data).getInt()
    }

    /**
     * Reads one more {@link PlayerTickData}, if there are still records in the packet.
     * @param dst - the data that will be read
     * @returns true if the data has been read
     */
    readTickData(dst: PlayerTickData): boolean {
        if (this.dc.remaining > 1) {
            dst.readInput(this.dc)
            dst.readContextAndOutput(this.dc)
            return true
        }
        return false
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

    private static inDc = new InDeltaCompressor(null, DEBUG_USE_HASH)
    private static outDc = new OutDeltaCompressor(null, DEBUG_USE_HASH)

    knownPhysicsTicks: int
    data = new PlayerTickData()

    export(): PacketBuffer {
        const dc = PlayerControlCorrectionPacket.outDc.start()
        dc.putInt(this.knownPhysicsTicks)
        this.data.writeContextAndOutput(dc)
        return dc.putHash().export()
    }

    read(buf: PacketBuffer) {
        const dc = PlayerControlCorrectionPacket.inDc.start(buf)
        this.knownPhysicsTicks = dc.getInt()
        this.data.readContextAndOutput(dc)
        dc.checkHash()
    }
}