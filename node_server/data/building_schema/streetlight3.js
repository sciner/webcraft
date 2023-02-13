export default {
    name: 'streetlight3',
    world: {
        pos1: { x: -163, y: 0, z: 10 },
        pos2: { x: -165, y: 7, z: 8 },
        entrance: { x: -164, y: 1, z: 9 },
    },
    size: { x: 3, y: 8, z: 3 },
    door_pos: { x: 1, y: 1, z: 1 },
    blocks: [
        { move: { x: -1, y: -1, z: 0 }, block_id: 468 },
        { move: { x: -1, y: -1, z: 1 }, block_id: 468 },
        {
            move: { x: -1, y: 0, z: 0 },
            block_id: 615,
            extra_data: {
                point: { x: 0.18008187497957806, y: 0, z: 0.527308622454953 },
            },
            rotate: { x: 3, y: 1, z: 0 },
        },
        {
            move: { x: -1, y: 3, z: 0 },
            block_id: 652,
            rotate: { x: 3, y: -1, z: 0 },
        },
        { move: { x: -1, y: 4, z: 0 }, block_id: 85 },
        {
            move: { x: -1, y: 5, z: 0 },
            block_id: 465,
            extra_data: {
                point: { x: 0.37712360195058636, y: 0, z: 0.5809198629758168 },
                opened: false,
            },
            rotate: { x: 3, y: 1, z: 0 },
        },
        { move: { x: 0, y: -1, z: -1 }, block_id: 468 },
        { move: { x: 0, y: -1, z: 0 }, block_id: 468 },
        { move: { x: 0, y: -1, z: 1 }, block_id: 468 },
        {
            move: { x: 0, y: 0, z: -1 },
            block_id: 615,
            extra_data: {
                point: { x: 0.5497689574272897, y: 0, z: 0.35480012444708287 },
            },
            rotate: { x: 0, y: 1, z: 0 },
        },
        { move: { x: 0, y: 0, z: 0 }, block_id: 98 },
        {
            move: { x: 0, y: 0, z: 1 },
            block_id: 615,
            extra_data: {
                point: { x: 0.9642491430220161, y: 0, z: 0.7601962312639614 },
            },
            rotate: { x: 2, y: 1, z: 0 },
        },
        { move: { x: 0, y: 1, z: 0 }, block_id: 139 },
        { move: { x: 0, y: 2, z: 0 }, block_id: 85 },
        { move: { x: 0, y: 3, z: 0 }, block_id: 85 },
        { move: { x: 0, y: 4, z: 0 }, block_id: 139 },
        {
            move: { x: 0, y: 5, z: 0 },
            block_id: 461,
            extra_data: {
                point: { x: 0.46818329803048186, y: 0, z: 0.6519429965857597 },
            },
        },
        { move: { x: 1, y: -1, z: -1 }, block_id: 468 },
        { move: { x: 1, y: -1, z: 0 }, block_id: 468 },
        { move: { x: 1, y: -1, z: 1 }, block_id: 468 },
        {
            move: { x: 1, y: 0, z: 0 },
            block_id: 615,
            extra_data: {
                point: { x: 0.7527271332602368, y: 0, z: 0.6041357393221105 },
            },
            rotate: { x: 1, y: 1, z: 0 },
        },
        {
            move: { x: 1, y: 3, z: 0 },
            block_id: 652,
            rotate: { x: 2, y: -1, z: 0 },
        },
        { move: { x: 1, y: 4, z: 0 }, block_id: 85 },
        {
            move: { x: 1, y: 5, z: 0 },
            block_id: 465,
            extra_data: {
                point: { x: 0.6886634459674212, y: 0, z: 0.42556576005232927 },
                opened: false,
            },
            rotate: { x: 1, y: 1, z: 0 },
        },
    ],
    rot: [],
};
