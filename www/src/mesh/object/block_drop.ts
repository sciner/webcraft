import { FakeTBlock } from '../../blocks.js';
import { Vector, unixTime, Helpers, QUAD_FLAGS } from '../../helpers.js';
import { NetworkPhysicObject } from '../../network_physic_object.js';
import { MeshGroup } from '../group.js';


const {mat4} = glMatrix;
const tmpMatrix = mat4.create();

// Mesh_Object_Block_Drop
export default class Mesh_Object_Block_Drop extends NetworkPhysicObject {

    static neighbours = null;

    static mesh_groups_cache = new Map();

    // Constructor
    constructor(gl, entity_id, items, pos, matrix, pivot, use_cache = false) {

        super(
            new Vector(pos.x, pos.y, pos.z),
            new Vector(0, 0, 0)
        );

        this.create_time = performance.now();
        this.entity_id = entity_id;
        const block = items[0];

        this.scale          = new Vector(.2, .2, .2);
        this.pn             = performance.now() + Math.random() * 2000; // рандом, чтобы одновременно сгенерированные дропы крутились не одинаково
        this.life           = 1.0;
        this.posFact        = this.pos.clone();
        this.block          = new FakeTBlock(block.id);
        this.block_material = this.block.material;

        // draw_style
        let draw_style = this.block_material?.inventory_style ?? this.block_material.style;
        if('inventory' in this.block_material) {
            draw_style = this.block_material.inventory.style;
        }

        // Get from cache
        this.mesh_group = use_cache ? Mesh_Object_Block_Drop.mesh_groups_cache.get(block.id) : null;

        if(this.mesh_group) {
            // do nothing

        } else {

            let x = 0;
            let y = 0;
            let z = 0;

            if (draw_style === 'extruder') {
                x = y = z = 0.5;
            }

            // MeshGroup
            this.mesh_group = new MeshGroup();

            // 1. First main block
            this.mesh_group.addBlock(new Vector(0, 0, 0), this.block);

            // 2. Add couples block
            if(['fence', 'wall'].includes(block.style_name)) {
                this.mesh_group.addBlock(new Vector(1, 0, 0), new FakeTBlock(block.id));
            }

            // 3. Add all block parts
            if(!('inventory' in this.block_material)) {
                let pos = new Vector(0, 0, 0);
                let next_part = this.block.material.next_part
                while(next_part) {
                    const next = new FakeTBlock(next_part.id);
                    pos = pos.add(next_part.offset_pos);
                    this.mesh_group.addBlock(pos, next);
                    next_part = next.material.next_part;
                    this.mesh_group.multipart = true;
                }
            }

            // 4. Finalize mesh group (recalculate aabb and find blocks neighbours)
            this.mesh_group.finalize();

            // 5.
            this.mesh_group.aabb.translate(x, y, z).pad(.5);
            x -= this.mesh_group.aabb.width / 2;
            y -= this.mesh_group.aabb.height / 2;
            z -= this.mesh_group.aabb.depth / 2;
            if(this.mesh_group.aabb.y_min < 0) {
                y -= this.mesh_group.aabb.y_min;
            }

            // 6. Draw all blocks
            matrix = matrix || mat4.create();
            this.mesh_group.buildVertices(x, y, z, true, matrix, pivot);

            if(block?.extra_data?.enchantments) {
                for(const mesh of this.mesh_group.meshes.values()) {
                    mesh.buffer.changeFlags(QUAD_FLAGS.FLAG_ENCHANTED_ANIMATION, 'or');
                }
            }

            // 7.
            Mesh_Object_Block_Drop.mesh_groups_cache.set(block.id, this.mesh_group);
        }

        this.modelMatrix = mat4.create();
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.swapYZ().toArray());

        this.lightTex = null;
        this.chunk = null;

    }

    // Update light texture from chunk
    updateLightTex(render) {
        const chunk = render.world.chunkManager.getChunk(this.chunk_addr);
        if (!chunk) {
            return;
        }
        this.chunk = chunk;
        this.lightTex = chunk.getLightTexture(render.renderBackend);
    }

    pickup() {
        this.now_draw = true;
        // Qubatch.sounds.play('madcraft:entity.item.pickup', 'hit');
    }

    // Update player
    updatePlayer(player, delta) {

        if(this.now_draw || !player.game_mode.canPickupItems()) {
            return false;
        }

        const MAX_DIST_FOR_PICKUP       = 2.5;
        const MAX_FLY_TIME              = 200; // ms
        const MAX_FLY_SPEED             = 12; // m/s
        const MIN_DIST_FOR_PICKUP_NOW   = .3; // m

        const target_pos = player.lerpPos.add(new Vector(0, .85, 0));
        const dist = this.pos.distance(target_pos);

        // if drop item already find near player
        if(this.no_update) {
            if(dist < MIN_DIST_FOR_PICKUP_NOW) {
                clearTimeout(this.pickup_timeout);
                return this.pickup();
            }
            this.pos.addSelf(this.pos.sub(target_pos).normalize().multiplyScalarSelf(-MAX_FLY_SPEED * delta / 1000));
        } else if(dist < MAX_DIST_FOR_PICKUP && (performance.now() - this.create_time > MAX_FLY_TIME && !this.isDead())
        ) {
            if(this.age > 2) {
                // if dist less need, drop item start to fly to center of player body
                this.no_update = true;
                // start timeout for pickup
                this.pickup_timeout = setTimeout(() => {
                    this.pickup();
                }, MAX_FLY_TIME);
                //
                player.world.server.PickupDropItem([this.entity_id]);
            }
        } if(!this.no_update) {
            // if drop item in calm state
            this.update();
        }

    }

    get age() {
        return unixTime() - this.dt;
    }

    isDead() {
        return this.deathTime < (Date.now()/1000);
    }

    // Draw
    draw(render, delta) {

        if(this.now_draw || this.isDead()) {
            return false;
        }

        // this.update();
        this.updateLightTex(render);

        if(!this.chunk) {
            return;
        }

        // Calc position
        this.posFact.set(
            this.pos.x,
            this.pos.y,
            this.pos.z,
        );
        const addY = (performance.now() - this.pn) / 10;
        this.posFact.y += Math.sin(addY / 35) / Math.PI * .2;

        // Calc matrices
        mat4.identity(this.modelMatrix);
        mat4.translate(this.modelMatrix, this.modelMatrix, 
            [
                (this.posFact.x - this.chunk.coord.x),
                (this.posFact.z - this.chunk.coord.z),
                (this.posFact.y - this.chunk.coord.y + 3 / 16)
            ]
        );
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.toArray());
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, addY / 60);

        // Draw mesh group
        this.mesh_group.draw(render, this.chunk.coord, this.modelMatrix, this.lightTex);

    }

    /**
     * Push draw task directly without any pre-computation.
     * Any matrix updates should be applied manually
     * Allow prepend matrix to modelMatrix
     * @param {Render} render 
     * @param {mat4} prePendMatrix 
     */
     drawDirectly(render, prePendMatrix = null) {
        if (this.isDead()){
            return false;
        }
        if (prePendMatrix) {
            mat4.mul(tmpMatrix, prePendMatrix, this.modelMatrix);
        }

        // Draw mesh group
        let mx = prePendMatrix ? tmpMatrix : this.modelMatrix

        const mat = this.block.material
        if(mat.style == 'extruder') {
            const matrix = mat4.create()
            mat4.rotateZ(matrix, mx, Helpers.deg2rad(180))
            mat4.rotateY(matrix, matrix, Helpers.deg2rad(mat.diagonal ? -65 : -30))
            mx = matrix
        }

        this.mesh_group.draw(render, this.pos, mx, null);

        // TODO: Включить, чтобы рисовалась рука BBMODEL
        // Qubatch.player.arm.draw(render, this.pos, mx, null)

    }

    destroy() {
        // this.mesh_group.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
