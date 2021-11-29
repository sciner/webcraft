import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../www/js/chunk.js";
import {ServerClient} from "../www/js/server_client.js";
import {Vector} from "../www/js/helpers.js";

export class ServerChunk {

    constructor(world, addr) {
        this.world          = world;
        this.addr           = new Vector(addr);
        this.size           = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        this.connections    = new Map();
        this.modify_list    = new Map();
    }

    // Load from DB
    async load() {
        this.modify_list = await this.world.db.loadChunkModifiers(this.addr, this.size);
        if (this.addr.x == 181 && this.addr.y == 2 && this.addr.z == 174) {
            console.log("%s, modify_list.length = %d", this.addr.toHash(), this.modify_list.size);
        }
    }

    // Add player connection
    addPlayerConn(player) {
        this.connections.set(player.session.user_id, player);
    }

    // Chunk loaded
    loaded(player) {
        // @CmdChunkState
        let packets = [{
            name: ServerClient.CMD_CHUNK_LOADED,
            data: {
                addr:        this.addr,
                modify_list: Object.fromEntries(this.modify_list),
            }
        }];
        this.world.sendSelected(packets, [player.session.user_id], []);
        return true
    }

    // GetBlockKey
    getBlockKey(pos) {
        return new Vector(pos).toHash();
    }

    // Set block
    blockSet(player, params, notify_author) {

        /*if Worlds.Blocks.IsEgg(params.Item.ID) {
            material := Worlds.Blocks.List[params.Item.ID]
            chat_message := &Struct.ParamChatSendMessage{
                Username: conn.Session.Username,
                Text:     "/spawnmob " + strconv.Itoa(params.Pos.X) + ".5 " + strconv.Itoa(params.Pos.Y) + " " + strconv.Itoa(params.Pos.Z) + ".5 " + material.SpawnEgg.Type + " " + material.SpawnEgg.Skin,
            }
            this.World.Chat.SendMessage(conn, this.World, chat_message)
            return false
        }
        */
    
        let blockKey = this.getBlockKey(params.pos);
    
        /*
        // Если на этом месте есть сущность, тогда запретить ставить что-то на это место
        entity, entity_type := this.World.Entities.GetEntityByPos(params.Pos)
        if entity != nil {
            switch entity_type {
            case "chest":
                params.Item = entity.(*Chest).Item // this.ModifyList[blockKey]
            default:
                // этот случай ошибочный, такого не должно произойти
                params.Item = this.ModifyList[blockKey]
            }
            packet := Struct.JSONResponse{Name: Struct.CMD_BLOCK_SET, Data: params, ID: nil}
            packets := []Struct.JSONResponse{packet}
            cons := make(map[string]*PlayerConn, 0)
            cons[conn.ID] = conn
            this.World.SendSelected(packets, cons, []string{})
            return false
        }
    
        // Create entity
        switch params.Item.ID {
        case Struct.BLOCK_CHEST:
            params.Item.EntityID = this.World.Entities.CreateChest(this.World, conn, params)
            log.Println("CreateEntity", params.Item.EntityID)
            if len(params.Item.EntityID) == 0 {
                return false
            }
        }
        */

        //
        this.modify_list.set(blockKey, params.item);
        console.log('BlockSet', this.addr, params.pos, params.item, player.session.user_id);
        // Send to users
        let packets = [{
            name: ServerClient.CMD_BLOCK_SET,
            data: params
        }];
        //if notify_author {
        this.world.sendSelected(packets, this.connections, []);
        //} else {
        //	this.World.SendSelected(packets, this.Connections, []string{conn.ID})
        //}
        return true
    }

}