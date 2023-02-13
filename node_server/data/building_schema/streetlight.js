export default {
    name: 'streetlight',
    world: {
        pos1: { x: -155, y: 0, z: 10 },
        pos2: { x: -157, y: 5, z: 8 },
        entrance: { x: -156, y: 1, z: 9 },
    },
    meta: { draw_natural_basement: false, air_column_from_basement: true },
    size: { x: 3, y: 6, z: 3 },
    door_pos: { x: 1, y: 1, z: 1 },
    blocks: [
        { move: { x: -1, y: -1, z: -1 }, block_id: 468 },
        { move: { x: -1, y: -1, z: 0 }, block_id: 468 },
        { move: { x: -1, y: -1, z: 1 }, block_id: 468 },
        {
            move: { x: -1, y: 3, z: 0 },
            block_id: 50,
            rotate: { x: 3, y: 0, z: 0 },
        },
        { move: { x: 0, y: -1, z: -1 }, block_id: 468 },
        { move: { x: 0, y: -1, z: 0 }, block_id: 8 },
        { move: { x: 0, y: -1, z: 1 }, block_id: 468 },
        { move: { x: 0, y: 0, z: 0 }, block_id: 85 },
        { move: { x: 0, y: 1, z: 0 }, block_id: 85 },
        { move: { x: 0, y: 2, z: 0 }, block_id: 85 },
        {
            move: { x: 0, y: 3, z: -1 },
            block_id: 50,
            rotate: { x: 0, y: 0, z: 0 },
        },
        { move: { x: 0, y: 3, z: 0 }, block_id: 357 },
        {
            move: { x: 0, y: 3, z: 1 },
            block_id: 50,
            rotate: { x: 2, y: 0, z: 0 },
        },
        { move: { x: 1, y: -1, z: -1 }, block_id: 468 },
        { move: { x: 1, y: -1, z: 0 }, block_id: 468 },
        { move: { x: 1, y: -1, z: 1 }, block_id: 468 },
        {
            move: { x: 1, y: 3, z: 0 },
            block_id: 50,
            rotate: { x: 1, y: 0, z: 0 },
        },
    ],
    rot: [],
};
