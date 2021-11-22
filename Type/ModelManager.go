package Type

import (
	"encoding/json"
	"io/ioutil"
	"log"
)

type (
	// ModelManager ...
	ModelManager struct {
		List map[string]*MobModel
	}
	MobModel struct {
		Name     string            `json:"name"`
		Type     string            `json:"type"`
		Geom     string            `json:"geom"`
		BaseSkin string            `json:"baseSkin"`
		Skins    map[string]string `json:"skins"`
	}
)

//
func (this *ModelManager) Init() {
	log.Println("ModelManager.Init()")
	//
	this.List = make(map[string]*MobModel)
	//
	file, err := ioutil.ReadFile("www/media/models/database.json")
	if err != nil {
		log.Fatal(err)
	}
	data := make(map[string]interface{})
	_ = json.Unmarshal([]byte(file), &data)
	for key, value := range data {
		// Read assets
		if key == "assets" {
			for model_name, asset := range value.(map[string]interface{}) {
				asset_bytes, err := json.Marshal(asset)
				if err == nil {
					model := &MobModel{}
					err := json.Unmarshal(asset_bytes, model)
					if err == nil {
						model.Name = model_name
						this.List[model_name] = model
					}
				}
			}
		}
	}
}
