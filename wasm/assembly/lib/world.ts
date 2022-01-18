// this is struct
@unmanaged
export class ChunkManager {
    //
}

export class Queue {

}

@unmanaged
export class World {
    defDayLight: f32 = 0;

    // AS not allow use free propery
    // it shpuld be nulable or inited in constructor
    // welcome!
    chunkManager: ChunkManager | null;
    dayLight: Queue | null;
    light: Queue | null;
    dayLightSrc: Queue | null;
}