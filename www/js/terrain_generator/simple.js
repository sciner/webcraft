export default class Terrain_Generator {

    generate(chunk) {
        for(var x = 0; x < chunk.size.x; x++) {
            for(var y = 0; y < chunk.size.y; y++) {
                chunk.blocks[x][y][0] = blocks.BEDROCK;
            }
        }
    }

}
