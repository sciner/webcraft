import * as VAUX from "vauxcel";
import {Vector} from "../helpers/vector.js";
import glMatrix from "@vendors/gl-matrix-3.3.min.js";
import {Color} from "../helpers/color.js";
const {mat4} = glMatrix;

export let defaultGlobalUniforms = {
    u_projMatrix: mat4.create() as imat4,
    u_viewMatrix: mat4.create() as imat4,
    u_chunkBlockDist: 1 as float,
    u_brightness: 1 as float,
    u_resolution: [1, 1] as tupleFloat2,
    u_fogAddColor: [0, 0, 0, 0] as tupleFloat4,
    u_fogColor: [1, 1, 1, 1] as tupleFloat4,
    u_time: performance.now() as float,
    u_testLightOn: 0 as float,
    u_sunDir: [0, 0, 0, 0] as tupleFloat4,
    u_useNormalMap: 0 as float,
    u_gridChunkSize: [0, 0, 0] as tupleFloat3,
    u_gridTexSize: [0, 0, 0] as tupleFloat3,
    u_rain_strength: 0 as float,
    u_camera_pos: [0, 0, 0] as tupleFloat3,
    u_camera_posi: [0, 0, 0] as tupleInt3,
    u_eyeinwater: 0 as float,
    u_localLightRadius: 0 as float,
    u_fogOn: true
}

export class GlobalUniformGroup extends VAUX.UniformGroup<typeof defaultGlobalUniforms> {
    declare uniforms: typeof defaultGlobalUniforms;
    camPos = new Vector();
    gridChunkSize = new Vector();
    gridTexSize = new Vector();
    declare dirtyId: number;
    constructor() {
        super(Object.assign({}, defaultGlobalUniforms), true);

        this.projMatrix         = mat4.create();
        this.viewMatrix         = mat4.create();

        this.chunkBlockDist = 1;
        this.brightness = 1;
        this.resolution = [1, 1];
        this.fogAddColor = [0,0,0,0];
        this.fogColor = [1,1,1,1];
        this.time = performance.now();

        this.testLightOn = 0;

        this.sunDir = [0, 0, 0];
        this.useSunDir = false;

        this.eyeinwater = false;

        this.localLigthRadius = 0;
        this.rainStrength = 0;
    }

    update()
    {
        super.update();
    }

    get projMatrix(): imat4 {
        return this.uniforms.u_projMatrix;
    }

    set projMatrix(val)
    {
        this.uniforms.u_projMatrix = val
    }

    get viewMatrix(): imat4 {
        return this.uniforms.u_viewMatrix;
    }

    set viewMatrix(val)
    {
        this.uniforms.u_viewMatrix = val
    }

    get chunkBlockDist(): number {
        return this.uniforms.u_chunkBlockDist;
    }

    set chunkBlockDist(val)
    {
        this.uniforms.u_chunkBlockDist = val
    }

    get brightness(): number {
        return this.uniforms.u_brightness;
    }

    set brightness(val)
    {
        this.uniforms.u_brightness = val
    }

    get resolution(): tupleFloat2 {
        return this.uniforms.u_resolution;
    }

    set resolution(val)
    {
        this.uniforms.u_resolution = val
    }

    get fogAddColor(): tupleFloat4 {
        return this.uniforms.u_fogAddColor;
    }

    set fogAddColor(val)
    {
        this.uniforms.u_fogAddColor[3] = val[3];
        Color.decodeSRGB(val, this.uniforms.u_fogAddColor);
    }

    get fogColor(): tupleFloat4 {
        return this.uniforms.u_fogColor;
    }

    set fogColor(val)
    {
        this.uniforms.u_fogColor[3] = val[3];
        Color.decodeSRGB(val, this.uniforms.u_fogColor);
    }

    get time(): number {
        return this.uniforms.u_time;
    }

    set time(val)
    {
        this.uniforms.u_time = val
    }

    get testLightOn(): number {
        return this.uniforms.u_testLightOn;
    }

    set testLightOn(val)
    {
        this.uniforms.u_testLightOn = val
    }

    get sunDir(): tupleFloat3 {
        return this.uniforms.u_sunDir as any;
    }

    set sunDir(val)
    {
        this.uniforms.u_sunDir[0] = val[0];
        this.uniforms.u_sunDir[1] = val[1];
        this.uniforms.u_sunDir[2] = val[2];
    }

    get useSunDir(): boolean {
        return !!this.uniforms.u_sunDir[3];
    }

    set useSunDir(val)
    {
        this.uniforms.u_sunDir[3] = +val;
    }

    get useNormalMap(): boolean {
        return !!this.uniforms.u_useNormalMap;
    }

    set useNormalMap(val)
    {
        this.uniforms.u_useNormalMap = +val
    }

    get eyeinwater(): boolean {
        return !!this.uniforms.u_eyeinwater;
    }

    set eyeinwater(val)
    {
        this.uniforms.u_eyeinwater = +val
    }

    get localLigthRadius(): number {
        return this.uniforms.u_localLightRadius;
    }

    set localLigthRadius(val)
    {
        this.uniforms.u_localLightRadius = val
    }

    get rainStrength(): number {
        return this.uniforms.u_rain_strength;
    }

    set rainStrength(val)
    {
        this.uniforms.u_rain_strength = val
    }

    manualSync =  (ud: Dict<any>, uv: Dict<any>, renderer: VAUX.Renderer, syncData?: any)  => {
        if (!ud['u_camera_pos']) {
            return;
        }

        const cx = this.camPos.x, cy = this.camPos.y, cz = this.camPos.z;
        const px = Math.floor(cx), py = Math.floor(cy), pz = Math.floor(cz);
        uv.u_camera_pos[0] = cx - px;
        uv.u_camera_pos[1] = cz - pz;
        uv.u_camera_pos[2] = cy - py;
        uv.u_camera_posi[0] = px;
        uv.u_camera_posi[1] = pz;
        uv.u_camera_posi[2] = py;

        if (ud.u_gridChunkSize) {
            uv.u_gridChunkSize[0] = this.gridChunkSize.x;
            uv.u_gridChunkSize[1] = this.gridChunkSize.z;
            uv.u_gridChunkSize[2] = this.gridChunkSize.y;
        }
    }
}

export class LightUniformGroup extends VAUX.UniformGroup<{ u_lightOverride: tupleFloat3 }> {
    stack: Array<int> = [0x100ff];
    override = 0x100ff;
    declare uniforms: { u_lightOverride: tupleFloat3 };

    constructor() {
        super({u_lightOverride: new Float32Array(3) as any}, true);
    }

    update()
    {
        super.update();
    }

    manualSync = (ud: Dict<any>, uv: Dict<any>, renderer: VAUX.Renderer, syncData?: any)  => {
        if (!ud['u_lightOverride']) {
            return;
        }
        const {u_lightOverride} = this.uniforms;
        let val = this.override;

        if (val >= 0) {
            u_lightOverride[0] = (val & 0xff) / 255.0;
            u_lightOverride[1] = ((val >> 8) & 0xff) / 255.0;
            u_lightOverride[2] = 1.0 + (val >> 16);
        } else {
            u_lightOverride[0] = 0;
            u_lightOverride[1] = 0;
            u_lightOverride[2] = 0;
        }
    }

    pushOverride(val: number) {
        this.stack.push(val);
        this.override = val;
        this.update();
    }

    pushIfNull(val: number) {
        this.pushOverride(this.override < 0 ? val : this.override);
    }

    popOverride() {
        this.stack.pop();
        this.override = this.stack[this.stack.length - 1];
        this.update();
    }
}