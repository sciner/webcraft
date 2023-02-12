declare interface IGeoFile {
    format_version: string;
    skins: Record<string, any>;
    variant?: string;
    [key: string]: IGeoTree;
}

declare interface IGeoFileNew {
    format_version: string;
    skins: Record<string, any>;
    variant?: string;
    ['minecraft:geometry']: IGeoTreeNew[];
}

declare interface IGeoTreeDescription {
    texture_width: number;
    texture_height: number;
    visible_bounds_width: number;
    visible_bounds_height: number;
    visible_bounds_offset: [number, number, number];
}

declare interface IGeoTreeDescriptionNew extends IGeoTreeDescription {
    identifier: string;
}

declare interface IGeoTree extends IGeoTreeDescription {
    bones: IGeoTreeBones[];
}

declare interface IGeoTreeNew {
    description: IGeoTreeDescriptionNew;
    bones: IGeoTreeBones[];
}

declare type IVector = [number, number, number];

declare interface IGeoTreeBones {
    name: string;
    parent?: string;
    pivot?: IVector;
    rotation?: IVector;
    // legacy 1.8
    bind_pose_rotation?: IVector;
    cubes?: IGeoCube[];
    mirror?: boolean;
    terrainGeometry?: any;
}

declare interface IGeoCube {
    origin?: IVector;
    rotation?: IVector;
    size?: IVector;
    pivot?: IVector;
    inflate?: 0.5;
    uv: [number, number];
    mirror?: boolean;
}