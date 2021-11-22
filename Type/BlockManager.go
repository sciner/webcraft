package Type

import (
	"encoding/json"
	"io/ioutil"
	"log"
)

type (
	// BlockManager ...
	BlockManager struct {
		List      map[int]*Block
		SpawnEggs []int
	}
	BlockSpawnEgg struct {
		Type string `json:"type"`
		Skin string `json:"skin"`
	}
	Block struct {
		ID       int            `json:"id"`
		Name     string         `json:"name"`
		SpawnEgg *BlockSpawnEgg `json:"spawn_egg"`
	}
)

//
func (this *BlockManager) Init() {
	log.Println("BlockManager.Init()")
	//
	this.List = make(map[int]*Block)
	//
	file, err := ioutil.ReadFile("www/data/resource_packs.json")
	if err != nil {
		log.Fatal(err)
	}
	var arr []string
	err = json.Unmarshal([]byte(file), &arr)
	if err != nil {
		log.Fatal("Invalid JSON file www/data/resource_packs.json")
	}
	var max_block_id int
	//
	for _, path := range arr {
		rp_json_file := "www/data/" + path + "/blocks.json"
		rp_file, err := ioutil.ReadFile(rp_json_file)
		if err != nil {
			log.Fatal(err)
		}
		var blocks []*Block
		_ = json.Unmarshal(rp_file, &blocks)
		for _, b := range blocks {
			this.List[b.ID] = b
			// Calc max block ID
			if b.ID > max_block_id {
				max_block_id = b.ID
			}
			// Eggs dictionary
			if b.SpawnEgg != nil {
				this.SpawnEggs = append(this.SpawnEggs, b.ID)
			}
		}
	}
	log.Printf("Loaded %d blocks, max_block_id: %d", len(this.List), max_block_id)
	s, _ := json.Marshal(this.SpawnEggs)
	log.Println("Eggs " + string(s))
}

//
func (this *BlockManager) IsEgg(block_id int) bool {
	for _, x := range this.SpawnEggs {
		if x == block_id {
			return true
		}
	}
	return false
}
