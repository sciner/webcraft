import type {Chunk} from "./chunk.js";
import type {BaseResourcePack} from "./base_resource_pack.js";
import type {IvanArray} from "./helpers.js";

export class ChunkMesh {
    chunk: Chunk = null
    list: Array<any> = null
    inputId: string
    instanceCount: number
    resource_pack_id: string
    material_group: string
    material_shader: string
    texture_id: string
    key: string
    buffer: any = null
    customFlag = false
    rpl: IvanArray<ChunkMesh> = null;

    constructor(key: string, inputId: string, list: Array<any> = [0]) {
        let temp = key.split('/');
        this.resource_pack_id = temp[0];
        this.material_group = temp[1];
        this.material_shader = temp[2];
        this.texture_id = temp[3];
        this.key = key;
        this.inputId = inputId;
        this.setList(list);
    }

    setList(list: Array<any>) {
        this.list = list;
        this.instanceCount = list[0];
    }

    draw(render : any, resource_pack : BaseResourcePack, group, mat) {
        const {key, chunk, texture_id, buffer} = this;
        const {light} = chunk;
        let texMat = resource_pack.materials.get(key);
        if (!texMat) {
            texMat = mat.getSubMat(resource_pack.getTexture(texture_id).texture);
            resource_pack.materials.set(key, texMat);
        }
        mat = texMat;
        let dist = Qubatch.player.lerpPos.distance(chunk.coord);
        render.batch.setObjectDrawer(render.chunk);
        if (light.lightData && dist < 108) {
            // in case light of chunk is SPECIAL
            chunk.getLightTexture(render);
            if (light.lightTex) {
                const base = light.lightTex.baseTexture || light.lightTex;
                if (base._poolLocation <= 0) {
                    mat = chunk.lightMats.get(key);
                    if (!mat) {
                        mat = texMat.getLightMat(light.lightTex);
                        chunk.lightMats.set(key, mat);
                    }
                }
            }
        }
        render.chunk.draw(buffer, mat, chunk);
        return true;
    }
}