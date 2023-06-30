import {QUAD_FLAGS, Vector} from '../../helpers.js';
import { default as push_cube_style } from '../../block_style/cube.js';
import { GeometryTerrain } from "../../geometry_terrain.js";
import {Resources} from "../../resources.js";
import {BLOCK, FakeTBlock} from "../../blocks.js";
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import type {Renderer} from "../../render.js";
const {mat4} = glMatrix;

const push_cube = push_cube_style.func;

const CLOUDS_TEX_SIZE = 96;
const CLOUDS_TEX_SCALE = new Vector(16, 4, 16);
const CLOUDS_SIZE = CLOUDS_TEX_SCALE.mulScalar(CLOUDS_TEX_SIZE) // размер одного потворяющегося "чанка" облаков в игровых единицах
// Скорость ветра
const WIND_SPEED_X = 1 // движение на восток
const WIND_SPEED_Y = 0

// Насколько близко к облаку считается камера "внутри облака". Это чтобы включить туман до момента пересечения грани - избежать мигания
const CLOUD_CAMERA_MARGIN = 0.4

// Типы облаков R, G, B кодируются в текстуре соответственно красным, зеленым и синим цветами. Черный - старый тип.
enum CloudType { NONE = 0, OLD, R, G, B }

// Для каждого типа облаков - мин. и макс. Y блоков (включтельно). Отдельно для края и центра облака.
const CLOUD_Y: Dict<{border: [int, int], center: [int, int]}> = {}
CLOUD_Y[CloudType.OLD] = {
    center: [0, 2],
    border: [1, 1]
}
CLOUD_Y[CloudType.R] = {
    center: [11, 14],
    border: [12, 13]
}
CLOUD_Y[CloudType.G] = {
    center: [21, 25],
    border: [22, 23]
}
CLOUD_Y[CloudType.B] = {
    center: [10, 10],
    border: [10, 10]
}

export default class Mesh_Object_Clouds {

    geom            : GeometryTerrain
    modelMatrix
    private y_pos   : float
    private pos     = new Vector()  // временная точка
    loading         = false
    private pn      = performance.now()
    private tmpCloudsChunkCoord = new Vector()

    // данные блоков
    private dataWidth   : int
    private cloudType   : Uint8Array // см. CloudType
    private cloudMinY   : Int8Array // для каждого индеса - мин. высота, с которой начинаются блоки
    private cloudMaxY   : Int8Array // для каждого индеса - макс. высота (включиельно), на которой заканчиваются блоки
    private cz          : int
    private fakeBlock   : FakeTBlock

    // Constructor
    constructor(gl, height: float) {
        this.y_pos = height

        function getCloudType(x: int, z: int): CloudType {
            return cloudType[((z + width) % width) * cz + ((x + width) % width)]
        }

        // прочитать 2D данные из текстуры
        const imgData   = Resources.clouds.texture
        const width     = this.dataWidth    = CLOUDS_TEX_SIZE
        const area      = width * width
        const cz        = this.cz           = CLOUDS_TEX_SIZE
        const cloudType = this.cloudType    = new Uint8Array(area)
        for(let x = 0; x < width; x++) {
            for(let z = 0; z < width; z++) {
                const dataIndex = 4 * (z * imgData.width + x)
                const is_cloud = imgData.data[dataIndex + 3] > 10
                if (is_cloud) {
                    const index = z * cz + x
                    cloudType[index] = imgData.data[dataIndex] > 128 ? CloudType.R
                        : imgData.data[dataIndex + 1] > 128 ? CloudType.G
                        : imgData.data[dataIndex + 2] > 128 ? CloudType.B
                        : CloudType.OLD
                }
            }
        }

        // сгенерировать 3D облака (найти для каждого столбца облаков мин. и макс. Y)
        this.cloudMinY  = new Int8Array(area)
        this.cloudMaxY  = new Int8Array(area).fill(-1)
        this.fakeBlock  = new FakeTBlock(BLOCK.CLOUD.id)
        for(let x = 0; x < width; x++) {
            for(let z = 0; z < width; z++) {
                const index = z * cz + x
                const cloudY = CLOUD_Y[cloudType[index]]
                if (cloudY) {
                    const has4neighbours = getCloudType(x - 1, z) && getCloudType(x + 1, z) && getCloudType(x, z - 1) && getCloudType(x, z + 1)
                    const tuple = has4neighbours ? cloudY.center : cloudY.border
                    this.cloudMinY[index] = tuple[0]
                    this.cloudMaxY[index] = tuple[1]
                }
            }
        }

        // создать геометрию
        const neighbours  = {
            UP: null,
            DOWN: null,
            NORTH: null,
            SOUTH: null,
            WEST: null,
            EAST: null
        }
        const vertices  = [];
        for(let x = 0; x < width; x++) {
            for(let z = 0; z < width; z++) {
                const index = z * cz + x
                const minY = this.cloudMinY[index]
                const maxY = this.cloudMaxY[index]
                for(let y = minY; y <= maxY; y++) {
                    neighbours.NORTH = this.getBlock(x, y, z + 1)
                    neighbours.SOUTH = this.getBlock(x, y, z - 1)
                    neighbours.WEST = this.getBlock(x - 1, y, z)
                    neighbours.EAST = this.getBlock(x + 1, y, z)
                    neighbours.UP   = this.getBlock(x, y + 1, z)
                    neighbours.DOWN = this.getBlock(x, y - 1, z)
                    push_cube(this.fakeBlock, vertices, null, x, y, z, neighbours)
                }
            }
        }
        this.modelMatrix = mat4.create();
        mat4.scale(this.modelMatrix, this.modelMatrix, CLOUDS_TEX_SCALE.toArray());
        //
        // console.log(parseInt(this.vertices.length / GeometryTerrain.strideFloats) + ' quads in clouds ');
        //
        this.geom = new GeometryTerrain(new Float32Array(vertices));
        this.geom.changeFlags(QUAD_FLAGS.FLAG_NO_FOG | QUAD_FLAGS.FLAG_NO_AO, 'replace');
        this.geom.updateInternal();
    }

    /** Возвращает блок по координатам из массива блоков. Координаты могыт выходить за пределы массива. */
    private getBlock(x: int, y: int, z: int): FakeTBlock | null {
        const width = this.dataWidth
        const index = ((z + width) % width) * this.cz + ((x + width) % width)
        return this.cloudType[index] && y >= this.cloudMinY[index] && y <= this.cloudMaxY[index]
            ? this.fakeBlock
            : null
    }

    /** @return блок облака, в котором находится камера */
    isCameraInCloud(camPos: Vector): boolean {
        const cloudsCoord = this.getCloudsCoord(camPos)
        if (cloudsCoord) {
            for(let dx = -CLOUD_CAMERA_MARGIN; dx <= CLOUD_CAMERA_MARGIN; dx += 2 * CLOUD_CAMERA_MARGIN) {
                const x = (camPos.x - cloudsCoord.x + dx) / CLOUDS_TEX_SCALE.x | 0
                for(let dy = -CLOUD_CAMERA_MARGIN; dy <= CLOUD_CAMERA_MARGIN; dy += 2 * CLOUD_CAMERA_MARGIN) {
                    const y = (camPos.y - cloudsCoord.y + dy) / CLOUDS_TEX_SCALE.y | 0
                    for(let dz = -CLOUD_CAMERA_MARGIN; dz <= CLOUD_CAMERA_MARGIN; dz += 2 * CLOUD_CAMERA_MARGIN) {
                        const z = (camPos.z - cloudsCoord.z + dz) / CLOUDS_TEX_SCALE.z | 0
                        if (this.getBlock(x, y, z)) {
                            return true
                        }
                    }
                }
            }
        }
        return false
    }

    /** @return координаты угла одного повторяющегося "чанка" облаков, содержащего (x, z) камеры */
    private getCloudsCoord(cam_pos: Vector): Vector | null {
        if (cam_pos.y < 0) {
            return null
        }
        const size = CLOUDS_SIZE.x
        // координаты без учета ветра
        const y = cam_pos.y > 512 ? 1024.1 : this.y_pos; // this.pos.y
        let x = Math.floor(cam_pos.x / size) * size
        let z = Math.floor(cam_pos.z / size) * size
        // добавляем ветер
        x += (performance.now() - this.pn) / 1000 * WIND_SPEED_X
        z += (performance.now() - this.pn) / 1000 * WIND_SPEED_Y
        x = (((x - cam_pos.x) % size) - size) % size + cam_pos.x // удерживаем значение x от (cam_pos.x - size) до cam_pos.x
        z = (((z - cam_pos.z) % size) - size) % size + cam_pos.z
        return this.tmpCloudsChunkCoord.setScalar(x, y, z)
    }

    // Draw
    draw(render: Renderer, delta) {
        const cloudsCoord = this.getCloudsCoord(render.camPos)
        if (cloudsCoord == null) {
            return
        }

        const that = this
        const size = CLOUDS_SIZE.x;
        const material = render.defaultShader.materials.transparent;
        render.lightUniforms.pushOverride(0x10000);
        const context = render.renderBackend
        const gl = context.gl
        const {geom, pos} = this
        material.shader.updatePos(pos, this.modelMatrix)
        material.bind()
        geom.bind(material.shader)

        // сколько раз нужно повторять облака и какие части рисовать - на основе дальности прорисовки
        const camMax = render.camera.max
        const repeatAround = Math.min(2, Math.ceil(camMax / size))
        const camMinX = render.camPos.x - camMax
        const camMinZ = render.camPos.z - camMax
        const camMaxX = render.camPos.x + camMax
        const camMaxZ = render.camPos.z + camMax
        // нарисовать повторяющие участки облаков со сдвигом
        for(let mx = -repeatAround; mx <= repeatAround; mx++) {
            for(let mz = -repeatAround; mz <= repeatAround; mz++) {
                pos.set(cloudsCoord.x + mx * size, cloudsCoord.y, cloudsCoord.z + mz * size)
                if (pos.x + size > camMinX && pos.x < camMaxX && pos.z + size > camMinZ && pos.z < camMaxZ) {
                    /* старый код был закомментирован - может нужен
                    render.renderBackend.drawMesh(this.buffer, material, this.pos, this.modelMatrix);
                    */
                    material.shader.updatePosOnly(pos)
                    material.bind()
                    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, geom.size)
                    context.stat.drawquads += geom.size
                    context.stat.drawcalls++
                }
            }
        }
        render.lightUniforms.popOverride();

    }

    destroy() {
        this.geom.destroy();
    }

    get isAlive() : boolean {
        return true;
    }

}
